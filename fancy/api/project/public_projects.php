<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../config/app.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";

// 1. التأكد أن الطلب من نوع GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, "Method not allowed", [], 405);
}

try {
    // 2. جلب المشاريع المقبولة فقط (approved) مع اسم المصمم من جدول المستخدمين
    $stmtProjects = $pdo->prepare("
        SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) as designer_name
        FROM projects p
        JOIN designer_profiles dp ON p.designer_id = dp.id
        JOIN users u ON dp.user_id = u.id
        WHERE p.status = 'approved'
        ORDER BY p.created_at DESC
    ");
    $stmtProjects->execute();
    $publicProjects = $stmtProjects->fetchAll(PDO::FETCH_ASSOC);

    // 3. تجهيز الروابط الكاملة لصور الغلاف وصور الألبومات لكل مشروع
    foreach ($publicProjects as &$project) {
        $project['id'] = (int)$project['id'];
        $project['designer_id'] = (int)$project['designer_id'];
        
        // تحويل مسار صورة الغلاف الأساسية لرابط كامل يفتح مباشرة
        if (!empty($project['cover_image'])) {
            $project['cover_image_url'] = rtrim(APP_URL, '/') . '/' . ltrim($project['cover_image'], '/');
        } else {
            $project['cover_image_url'] = null;
        }

        // 4. جلب صور الألبوم لكل مشروع مقبول
        $stmtImages = $pdo->prepare("SELECT image_url FROM project_images WHERE project_id = ?");
        $stmtImages->execute([$project['id']]);
        $galleryRows = $stmtImages->fetchAll(PDO::FETCH_ASSOC);

        $galleryImages = [];
        foreach ($galleryRows as $row) {
            $galleryImages[] = rtrim(APP_URL, '/') . '/' . ltrim($row['image_url'], '/');
        }
        
        $project['gallery_images'] = $galleryImages;

        // إخفاء عمود الـ status في الـ Public API لزيادة الأمان والنظافة (الفرونت إند مش محتاجه لأن كله approved)
        unset($project['status']);
    }

    // 5. إرجاع البيانات بنجاح للعامة
    jsonResponse(true, "Public approved projects retrieved successfully", [
        "total_projects" => count($publicProjects),
        "projects" => $publicProjects
    ], 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}