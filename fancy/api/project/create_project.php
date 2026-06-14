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

$auth = requireAuth();
$userId = (int)$auth['user_id'];

try {
    // 1. التحقق من بروفايل المصمم وجلب الـ designer_id
    $stmtCheck = $pdo->prepare("SELECT id FROM designer_profiles WHERE user_id = ? LIMIT 1");
    $stmtCheck->execute([$userId]);
    $designer = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    if (!$designer) {
        jsonResponse(false, "You must create a designer profile first.", ["code" => "PROFILE_REQUIRED"], 403);
    }

    $designerId = (int)$designer['id'];

    // 2. استقبال البيانات النصية كاملة (مع دعم الكابيتال والسمول والمسافات)
    $title             = trim($_POST['Title'] ?? $_POST['title'] ?? '');
    $headerDescription = trim($_POST['Header_Description'] ?? $_POST['header_description'] ?? $_POST['Header Description'] ?? $_POST['header description'] ?? '');
    $description       = trim($_POST['Description'] ?? $_POST['description'] ?? '');
    $category          = trim($_POST['Category'] ?? $_POST['category'] ?? '');
    $type              = trim($_POST['Type'] ?? $_POST['type'] ?? ''); 
    
    // استقبال الحقول الجديدة (City & State)
    $city              = trim($_POST['City'] ?? $_POST['city'] ?? '');
    $state             = trim($_POST['State'] ?? $_POST['state'] ?? '');

    // التحقق من تعبئة جميع الحقول المطلوبة
    if (empty($title) || empty($headerDescription) || empty($description) || empty($category) || empty($type) || empty($city) || empty($state)) {
        jsonResponse(false, "All fields (Title, Header Description, Description, Category, Type, City, State) are required", ["code" => "VALIDATION_ERROR"], 422);
    }

    // مجلد الرفع الرئيسي
    $uploadDir = __DIR__ . "/../../uploads/projects/";
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

    // 3. رفع صورة الغلاف الأساسية
    $coverFile = $_FILES['image'] ?? $_FILES['cover_image'] ?? null;
    $coverImagePath = null;

    if ($coverFile && $coverFile['error'] === UPLOAD_ERR_OK) {
        $ext = strtolower(pathinfo($coverFile['name'], PATHINFO_EXTENSION));
        if (in_array($ext, $allowedExtensions)) {
            $newCoverName = "cover_" . time() . "_" . bin2hex(random_bytes(4)) . "." . $ext;
            if (move_uploaded_file($coverFile['tmp_name'], $uploadDir . $newCoverName)) {
                $coverImagePath = "uploads/projects/" . $newCoverName;
            }
        }
    }

    if (!$coverImagePath) {
        jsonResponse(false, "Main cover image is required", ["code" => "COVER_IMAGE_REQUIRED"], 422);
    }

    // 4. إدخال الهيكلية الكاملة للمشروع في جدول projects (بما فيها الحقول الجديدة)
    $stmtProject = $pdo->prepare("
        INSERT INTO projects (designer_id, title, header_description, description, category, type, city, state, cover_image, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");
    $stmtProject->execute([$designerId, $title, $headerDescription, $description, $category, $type, $city, $state, $coverImagePath]);
    $projectId = $pdo->lastInsertId();

    // 5. رفع ألبوم الصور الإضافية وحفظها في جدول project_images
    $uploadedGalleryImages = [];
    if (isset($_FILES['images']) && is_array($_FILES['images']['name'])) {
        $files = $_FILES['images'];
        $fileCount = count($files['name']);

        for ($i = 0; $i < $fileCount; $i++) {
            if ($files['error'][$i] === UPLOAD_ERR_OK) {
                $ext = strtolower(pathinfo($files['name'][$i], PATHINFO_EXTENSION));
                
                if (in_array($ext, $allowedExtensions)) {
                    $newGalleryName = "gallery_" . time() . "_" . bin2hex(random_bytes(4)) . "_" . $i . "." . $ext;
                    
                    if (move_uploaded_file($files['tmp_name'][$i], $uploadDir . $newGalleryName)) {
                        $galleryPath = "uploads/projects/" . $newGalleryName;
                        
                        // الربط بجدول ألبوم الصور
                        $stmtGallery = $pdo->prepare("INSERT INTO project_images (project_id, image_url) VALUES (?, ?)");
                        $stmtGallery->execute([$projectId, $galleryPath]);
                        
                        $uploadedGalleryImages[] = rtrim(APP_URL, '/') . '/' . $galleryPath;
                    }
                }
            }
        }
    }
    // 6. رد النجاح النهائي بكافة التفاصيل المتطورة
    jsonResponse(true, "Project uploaded successfully and awaiting admin approval", [
        "project_id"         => (int)$projectId,
        "designer_id"        => $designerId,
        "title"              => $title,
        "status"             => "pending", // الحقل الجديد عشان الفرونت إند يظهره فوراً كـ معلق
        "category"           => $category,
        "type"               => $type,
        "city"               => $city,
        "state"              => $state,
        "cover_image_url"    => rtrim(APP_URL, '/') . '/' . $coverImagePath,
        "gallery_images"     => $uploadedGalleryImages
    ], 201);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}