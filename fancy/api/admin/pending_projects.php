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

// 2. التحقق من صلاحيات الأدمن (إذا كنت تفحص التوكن للأدمن)
// $auth = requireAuth(); // يمكنك تفعيلها وتمرير توكن الأدمن لحماية الحقل

try {
    // 3. جلب المشاريع المعلقة مع دمج اسم المصمم ثلاثي/ثنائي من جدول المستخدمين
    $stmtProjects = $pdo->prepare("
        SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) as designer_name
        FROM projects p
        JOIN designer_profiles dp ON p.designer_id = dp.id
        JOIN users u ON dp.user_id = u.id
        WHERE p.status = 'pending'
        ORDER BY p.created_at ASC
    ");
    $stmtProjects->execute();
    $pendingProjects = $stmtProjects->fetchAll(PDO::FETCH_ASSOC);

    // 4. جلب الألبوم الكامل لكل مشروع معلق وتحويل مسارات الصور بروابط كاملة
    foreach ($pendingProjects as &$project) {
        $project['id'] = (int)$project['id'];
        $project['designer_id'] = (int)$project['designer_id'];
        
        // رابط صورة الغلاف الكامل
        if (!empty($project['cover_image'])) {
            $project['cover_image_url'] = rtrim(APP_URL, '/') . '/' . ltrim($project['cover_image'], '/');
        } else {
            $project['cover_image_url'] = null;
        }

        // جلب صور الألبوم الخاصة بالمشروع المعلق
        $stmtImages = $pdo->prepare("SELECT image_url FROM project_images WHERE project_id = ?");
        $stmtImages->execute([$project['id']]);
        $galleryRows = $stmtImages->fetchAll(PDO::FETCH_ASSOC);

        $galleryImages = [];
        foreach ($galleryRows as $row) {
            $galleryImages[] = rtrim(APP_URL, '/') . '/' . ltrim($row['image_url'], '/');
        }
        
        $project['gallery_images'] = $galleryImages;
    }

    // 5. رد النجاح للأدمن
    jsonResponse(true, "Pending projects retrieved successfully", [
        "total_pending" => count($pendingProjects),
        "projects" => $pendingProjects
    ], 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}