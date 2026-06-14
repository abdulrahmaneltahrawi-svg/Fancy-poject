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

// 1. التأكد أن الطلب من نوع POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// 2. التحقق من تسجيل الدخول
$auth = requireAuth();
$userId = (int)$auth['user_id'];

try {
    // 3. استقبال البيانات
    $projectId         = (int)($_POST['project_id'] ?? 0);
    $title             = trim($_POST['title'] ?? '');
    $headerDescription = trim($_POST['header_description'] ?? '');
    $description       = trim($_POST['description'] ?? '');
    $category          = trim($_POST['category'] ?? '');
    $type              = trim($_POST['type'] ?? '');
    $city              = trim($_POST['city'] ?? '');
    $state             = trim($_POST['state'] ?? '');

    if (empty($projectId)) {
        jsonResponse(false, "Project ID (project_id) is required", ["code" => "VALIDATION_ERROR"], 422);
    }

    // 4. جلب الـ designer_id
    $stmtCheckDesigner = $pdo->prepare("SELECT id FROM designer_profiles WHERE user_id = ? LIMIT 1");
    $stmtCheckDesigner->execute([$userId]);
    $designer = $stmtCheckDesigner->fetch(PDO::FETCH_ASSOC);

    if (!$designer) {
        jsonResponse(false, "Designer profile not found.", ["code" => "PROFILE_REQUIRED"], 404);
    }
    $designerId = (int)$designer['id'];

    // 5. التأكد من ملكية المشروع
    $stmtCheckProject = $pdo->prepare("SELECT * FROM projects WHERE id = ? AND designer_id = ? LIMIT 1");
    $stmtCheckProject->execute([$projectId, $designerId]);
    $project = $stmtCheckProject->fetch(PDO::FETCH_ASSOC);

    if (!$project) {
        jsonResponse(false, "Project not found or you don't have permission to edit it", ["code" => "UNAUTHORIZED_ACTION"], 403);
    }

    // الاحتفاظ بالبيانات القديمة إذا لم تُرسل قيم جديدة
    $title             = !empty($title) ? $title : $project['title'];
    $headerDescription = !empty($headerDescription) ? $headerDescription : $project['header_description'];
    $description       = !empty($description) ? $description : $project['description'];
    $category          = !empty($category) ? $category : $project['category'];
    $type              = !empty($type) ? $type : $project['type'];
    $city              = !empty($city) ? $city : $project['city'];
    $state             = !empty($state) ? $state : $project['state'];

    // 6. معالجة صورة الغلاف
    $uploadDir = __DIR__ . "/../../uploads/projects/";
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $coverFile = $_FILES['image'] ?? $_FILES['cover_image'] ?? null;
    $coverImagePath = $project['cover_image'];

    if ($coverFile && $coverFile['error'] === UPLOAD_ERR_OK) {
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
        $ext = strtolower(pathinfo($coverFile['name'], PATHINFO_EXTENSION));

        if (in_array($ext, $allowedExtensions)) {
            $newCoverName = "cover_" . time() . "_" . bin2hex(random_bytes(4)) . "." . $ext;

            if (move_uploaded_file($coverFile['tmp_name'], $uploadDir . $newCoverName)) {
                if (!empty($project['cover_image'])) {
                    $oldFullPath = __DIR__ . "/../../" . ltrim($project['cover_image'], '/');
                    if (file_exists($oldFullPath)) {
                        @unlink($oldFullPath);
                    }
                }
                $coverImagePath = "uploads/projects/" . $newCoverName;
            }
        } else {
            jsonResponse(false, "Invalid image extension.", ["code" => "INVALID_FILE_TYPE"], 422);
        }
    }

    // 7. تحديث قاعدة البيانات (تم إزالة updated_at لتتوافق مع جدولك الحالي)
    $stmtUpdate = $pdo->prepare("
        UPDATE projects 
        SET title = ?, header_description = ?, description = ?, category = ?, type = ?, city = ?, state = ?, cover_image = ?, status = 'pending'
        WHERE id = ? AND designer_id = ?
    ");
    $stmtUpdate->execute([
        $title, 
        $headerDescription, 
        $description, 
        $category, 
        $type, 
        $city, 
        $state, 
        $coverImagePath, 
        $projectId, 
        $designerId
    ]);

    jsonResponse(true, "Project updated successfully and is now pending admin review", [
        "project_id"         => $projectId,
        "title"              => $title,
        "status"             => "pending",
        "category"           => $category,
        "type"               => $type,
        "city"               => $city,
        "state"              => $state,
        "cover_image_url"    => rtrim(APP_URL, '/') . '/' . ltrim($coverImagePath, '/')
    ], 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}