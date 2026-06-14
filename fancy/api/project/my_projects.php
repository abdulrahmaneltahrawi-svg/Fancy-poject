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

// 1. التأكد أن الطلب من نوع GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// 2. التحقق من تسجيل الدخول وجلب بيانات المستخدم
$auth = requireAuth();
$userId = (int)$auth['user_id'];

try {
    // 3. جلب الـ designer_id المرتبط بحساب المستخدم الحالي
    $stmtCheck = $pdo->prepare("SELECT id FROM designer_profiles WHERE user_id = ? LIMIT 1");
    $stmtCheck->execute([$userId]);
    $designer = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    if (!$designer) {
        jsonResponse(false, "Designer profile not found.", ["code" => "PROFILE_REQUIRED"], 404);
    }

    $designerId = (int)$designer['id'];

    // 4. جلب جميع مشاريع هذا المصمم من الأحدث للأقدم
    $stmtProjects = $pdo->prepare("
        SELECT * FROM projects 
        WHERE designer_id = ? 
        ORDER BY created_at DESC
    ");
    $stmtProjects->execute([$designerId]);
    $projects = $stmtProjects->fetchAll(PDO::FETCH_ASSOC);

    // 5. تجهيز روابط الصور الكاملة للمشاريع وللألبوم الإضافي
    foreach ($projects as &$project) {
        $project['id'] = (int)$project['id'];
        $project['designer_id'] = (int)$project['designer_id'];
        
        // تحويل مسار صورة الغلاف الأساسية لرابط كامل
        if (!empty($project['cover_image'])) {
            $project['cover_image_url'] = rtrim(APP_URL, '/') . '/' . ltrim($project['cover_image'], '/');
        } else {
            $project['cover_image_url'] = null;
        }

        // 6. استعلام ذكي داخل اللوب لجلب كافة صور الألبوم المرتبطة بهذا المشروع بالذات
        $stmtImages = $pdo->prepare("SELECT image_url FROM project_images WHERE project_id = ?");
        $stmtImages->execute([$project['id']]);
        $galleryRows = $stmtImages->fetchAll(PDO::FETCH_ASSOC);

        $galleryImages = [];
        foreach ($galleryRows as $row) {
            // تحويل كل مسار صورة في الألبوم لرابط كامل يفتح مباشرة
            $galleryImages[] = rtrim(APP_URL, '/') . '/' . ltrim($row['image_url'], '/');
        }
        
        // دمج مصفوفة الصور داخل بيانات المشروع
        $project['gallery_images'] = $galleryImages;
    }

    // 7. إرجاع البيانات بنجاح وبشكل متكامل للفرونت إند
    jsonResponse(true, "Projects with full galleries retrieved successfully", [
        "total_projects" => count($projects),
        "projects" => $projects
    ], 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}