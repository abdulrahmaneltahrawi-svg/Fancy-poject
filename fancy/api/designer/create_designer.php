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

function uploadAvatar($fileInputName)
{
    if (!isset($_FILES[$fileInputName]) || $_FILES[$fileInputName]['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    $file = $_FILES[$fileInputName];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(false, "Avatar upload error", ["code" => "AVATAR_UPLOAD_ERROR"], 400);
    }

    $maxSize = 2 * 1024 * 1024; // 2MB
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

// استقبال وتطهير البيانات النصية القادمة من الفرونت إند
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
    // 1. التحقق من أن المستخدم ليس لديه بروفايل مصمم مسبقاً (العلاقة 1:1)
    $stmt = $pdo->prepare("SELECT id FROM designer_profiles WHERE user_id = ? LIMIT 1");
    $stmt->execute([$auth['user_id']]);
    if ($stmt->fetch()) {
        jsonResponse(false, "Designer profile already exists for this user", ["code" => "PROFILE_ALREADY_EXISTS"], 409);
    }

    // بدء الـ Transaction لحماية ترابط الجداول والوسوم
    $pdo->beginTransaction();

    // 2. رفع صورة الأفاتار
    $avatarPath = uploadAvatar('avatar');

    // 3. إدخال بيانات البروفايل الأساسية بحالة pending تلقائياً للمراجعة
    $stmtProfile = $pdo->prepare("
        INSERT INTO designer_profiles (
            user_id, company_type, country, city, bio, avatar, 
            website_url, email_contact, linkedin_url, instagram_url, whatsapp_number, status
        ) VALUES (
            :user_id, :company_type, :country, :city, :bio, :avatar, 
            :website_url, :email_contact, :linkedin_url, :instagram_url, :whatsapp_number, 'pending'
        )
    ");

    $stmtProfile->execute([
        ":user_id" => $auth['user_id'],
        ":company_type" => $companyType ?: null,
        ":country" => $country ?: null,
        ":city" => $city ?: null,
        ":bio" => $bio ?: null,
        ":avatar" => $avatarPath,
        ":website_url" => $websiteUrl ?: null,
        ":email_contact" => $emailContact ?: null,
        ":linkedin_url" => $linkedinUrl ?: null,
        ":instagram_url" => $instagramUrl ?: null,
        ":whatsapp_number" => $whatsappNumber ?: null
    ]);

    $designerId = $pdo->lastInsertId();

    /*
    |--------------------------------------------------------------------------
    | 4. نظام الوسوم الديناميكي (إضافة الخدمات بالاسم النصي)
    |--------------------------------------------------------------------------
    */
    $servicesRaw = $_POST['services'] ?? '[]'; // الإرسال بالبوست مان: ["Interior", "Modern Decor"]
    $servicesNames = is_string($servicesRaw) ? json_decode($servicesRaw, true) : $servicesRaw;

    if (!empty($servicesNames) && is_array($servicesNames)) {
        $stmtCheckService = $pdo->prepare("SELECT id FROM services WHERE name = ? LIMIT 1");
        $stmtInsertService = $pdo->prepare("INSERT INTO services (name) VALUES (?)");
        $stmtLinkService = $pdo->prepare("INSERT INTO designer_services (designer_id, service_id) VALUES (?, ?)");

        foreach ($servicesNames as $name) {
            $name = cleanInput($name);
            if ($name === '') continue;

            // أ. التحقق هل اسم الخدمة موجود في جدول services مسبقاً؟
            $stmtCheckService->execute([$name]);
            $service = $stmtCheckService->fetch();

            if ($service) {
                $serviceId = (int)$service['id'];
            } else {
                // ب. إذا لم تكن موجودة، ننشئها كخدمة عامة جديدة فوراً في السيستم
                $stmtInsertService->execute([$name]);
                $serviceId = (int)$pdo->lastInsertId();
            }

            // ج. ربط الخدمة بملف المصمم الحالي في الجدول الوسيط
            $stmtLinkService->execute([$designerId, $serviceId]);
        }
    }

    // تأكيد العمليات بالكامل
    $pdo->commit();

    jsonResponse(true, "Designer profile created successfully and pending approval", [
        "designer_id" => (int)$designerId,
        "status" => "pending",
        "avatar" => $avatarPath,
        "avatar_url" => imageUrl($avatarPath)
    ], 201);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}