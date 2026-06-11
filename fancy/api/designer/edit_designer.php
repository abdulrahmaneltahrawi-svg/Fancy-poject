<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../config/app.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";
require_once __DIR__ . "/../../core/auth.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// حماية الـ API والتأكد من تسجيل الدخول
$auth = requireAuth();

function imageUrl($path)
{
    if (!$path) {
        return null;
    }
    return rtrim(APP_URL, '/') . '/' . ltrim($path, '/');
}

function deleteOldAvatar($path)
{
    if (!$path) return;
    $fullPath = __DIR__ . "/../../" . ltrim($path, '/');
    if (file_exists($fullPath) && is_file($fullPath)) {
        unlink($fullPath);
    }
}

function uploadAvatar($fileInputName)
{
    if (!isset($_FILES[$fileInputName]) || $_FILES[$fileInputName]['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    $file = $_FILES[$fileInputName];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(false, "Avatar upload error", ["code" => "AVATAR_UPLOAD_ERROR"], 400);
    }

    $maxSize = 2 * 1024 * 1024;
    if ($file['size'] > $maxSize) {
        jsonResponse(false, "Avatar size must not exceed 2MB", ["code" => "AVATAR_TOO_LARGE"], 422);
    }

    $allowedMimeTypes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $mimeType = mime_content_type($file['tmp_name']);

    if (!array_key_exists($mimeType, $allowedMimeTypes)) {
        jsonResponse(false, "Only JPG, PNG and WEBP images are allowed", ["code" => "INVALID_IMAGE_TYPE"], 422);
    }

    $uploadDir = __DIR__ . "/../../uploads/avatars/";
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0775, true);
    }

    $fileName = "avatar_" . time() . "_" . bin2hex(random_bytes(8)) . "." . $allowedMimeTypes[$mimeType];
    if (!move_uploaded_file($file['tmp_name'], $uploadDir . $fileName)) {
        jsonResponse(false, "Could not save avatar image", ["code" => "AVATAR_SAVE_FAILED"], 500);
    }

    return "uploads/avatars/" . $fileName;
}

$companyType = cleanInput($_POST['company_type'] ?? '');
$country = cleanInput($_POST['country'] ?? '');
$city = cleanInput($_POST['city'] ?? '');
$bio = cleanInput($_POST['bio'] ?? '');
$websiteUrl = cleanInput($_POST['website_url'] ?? '');
$emailContact = cleanInput($_POST['email_contact'] ?? '');
$linkedinUrl = cleanInput($_POST['linkedin_url'] ?? '');
$instagramUrl = cleanInput($_POST['instagram_url'] ?? '');
$whatsappNumber = cleanInput($_POST['whatsapp_number'] ?? '');

try {
    // 1. جلب البروفايل الحالي والتأكد من ملكيته للمستخدم الحلي
    $stmt = $pdo->prepare("SELECT id, avatar, status FROM designer_profiles WHERE user_id = ? LIMIT 1");
    $stmt->execute([$auth['user_id']]);
    $profile = $stmt->fetch();

    if (!$profile) {
        jsonResponse(false, "Designer profile not found", ["code" => "PROFILE_NOT_FOUND"], 404);
    }

    $designerId = (int)$profile['id'];

    $pdo->beginTransaction();

    // 2. معالجة وحفظ الأفاتار الجديد ومسح القديم
    $newAvatarPath = uploadAvatar('avatar');
    $finalAvatarPath = $newAvatarPath ?: $profile['avatar'];

    if ($newAvatarPath && $profile['avatar']) {
        deleteOldAvatar($profile['avatar']);
    }

    // أمان: إذا تم تعديل البروفايل وهو مقبول (approved)، يعود فوراً إلى المراجعة (pending)
    $newStatus = $profile['status'] === 'approved' ? 'pending' : $profile['status'];

    // 3. تحديث جدول الـ profiles
    $stmtUpdate = $pdo->prepare("
        UPDATE designer_profiles 
        SET 
            company_type = :company_type, country = :country, city = :city, bio = :bio, 
            avatar = :avatar, website_url = :website_url, email_contact = :email_contact, 
            linkedin_url = :linkedin_url, instagram_url = :instagram_url, whatsapp_number = :whatsapp_number,
            status = :status
        WHERE id = :id
    ");

    $stmtUpdate->execute([
        ":company_type" => $companyType ?: null,
        ":country" => $country ?: null,
        ":city" => $city ?: null,
        ":bio" => $bio ?: null,
        ":avatar" => $finalAvatarPath,
        ":website_url" => $websiteUrl ?: null,
        ":email_contact" => $emailContact ?: null,
        ":linkedin_url" => $linkedinUrl ?: null,
        ":instagram_url" => $instagramUrl ?: null,
        ":whatsapp_number" => $whatsappNumber ?: null,
        ":status" => $newStatus,
        ":id" => $designerId
    ]);

    /*
    |--------------------------------------------------------------------------
    | 4. نظام المزامنة الديناميكي الذكي للأوسمة (Sync Tags Workflow)
    |--------------------------------------------------------------------------
    */
    $servicesRaw = $_POST['services'] ?? '[]';
    $servicesNames = is_string($servicesRaw) ? json_decode($servicesRaw, true) : $servicesRaw;
    if (!is_array($servicesNames)) $servicesNames = [];

    $currentRequestServiceIds = [];

    // تحويل الأسماء المبعوتة إلى الـ IDs المقابلة لها (إنشاء الخدمة لو جديدة تماماً)
    if (!empty($servicesNames)) {
        $stmtCheckService = $pdo->prepare("SELECT id FROM services WHERE name = ? LIMIT 1");
        $stmtInsertService = $pdo->prepare("INSERT INTO services (name) VALUES (?)");

        foreach ($servicesNames as $name) {
            $name = cleanInput($name);
            if ($name === '') continue;

            $stmtCheckService->execute([$name]);
            $service = $stmtCheckService->fetch();

            if ($service) {
                $currentRequestServiceIds[] = (int)$service['id'];
            } else {
                $stmtInsertService->execute([$name]);
                $currentRequestServiceIds[] = (int)$pdo->lastInsertId();
            }
        }
    }

    // جلب الـ IDs القديمة المسجلة للمصمم ده في الجدول الوسيط حالياً
    $stmtOld = $pdo->prepare("SELECT service_id FROM designer_services WHERE designer_id = ?");
    $stmtOld->execute([$designerId]);
    $oldServices = $stmtOld->fetchAll(PDO::FETCH_COLUMN);

    // أ. ربط الخدمات الجديدة التي طلبها التاجر ولم تكن مرتبطة به مسبقاً
    $toInsert = array_diff($currentRequestServiceIds, $oldServices);
    if (!empty($toInsert)) {
        $stmtIns = $pdo->prepare("INSERT INTO designer_services (designer_id, service_id) VALUES (?, ?)");
        foreach ($toInsert as $sId) {
            $stmtIns->execute([$designerId, (int)$sId]);
        }
    }

    // ب. حذف روابط الخدمات التي قام المصمم بإزالتها من الواجهة
    $toDelete = array_diff($oldServices, $currentRequestServiceIds);
    if (!empty($toDelete)) {
        $placeholders = implode(',', array_fill(0, count($toDelete), '?'));
        $stmtDel = $pdo->prepare("DELETE FROM designer_services WHERE designer_id = ? AND service_id IN ($placeholders)");
        $stmtDel->execute(array_merge([$designerId], array_map('intval', $toDelete)));
    }

    $pdo->commit();

    jsonResponse(true, "Designer profile updated successfully", [
        "designer_id" => $designerId,
        "status" => $newStatus,
        "avatar" => $finalAvatarPath,
        "avatar_url" => imageUrl($finalAvatarPath)
    ], 200);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse(false, "Something went wrong during update", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}