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
    // 2. استقبال معرف المشروع من الـ URL Params
    $projectId = (int)($_GET['project_id'] ?? $_GET['id'] ?? 0);

    // ---------------------------------------------------
    // الحالة الأولى: عرض تفاصيل مشروع محدد بالـ ID (صفحة تفاصيل المشروع)
    // ---------------------------------------------------
    if ($projectId > 0) {
        
        // جلب بيانات المشروع مع اسم المصمم بالكامل
        $stmt = $pdo->prepare("
            SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) as designer_name
            FROM projects p
            JOIN designer_profiles dp ON p.designer_id = dp.id
            JOIN users u ON dp.user_id = u.id
            WHERE p.id = ? LIMIT 1
        ");
        $stmt->execute([$projectId]);
        $project = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            jsonResponse(false, "Project not found", ["code" => "NOT_FOUND"], 404);
        }

        // تحويل مسار صورة الغلاف الأساسية لرابط كامل
        $project['cover_image_url'] = !empty($project['cover_image']) 
            ? rtrim(APP_URL, '/') . '/' . ltrim($project['cover_image'], '/') 
            : null;

        // جلب ألبوم الصور الإضافية (Gallery) الخاص بهذا المشروع
        $stmtImages = $pdo->prepare("SELECT image_url FROM project_images WHERE project_id = ?");
        $stmtImages->execute([$projectId]);
        $galleryRows = $stmtImages->fetchAll(PDO::FETCH_ASSOC);

        $galleryImages = [];
        foreach ($galleryRows as $row) {
            $galleryImages[] = rtrim(APP_URL, '/') . '/' . ltrim($row['image_url'], '/');
        }
        
        // دمج الألبوم داخل كائن المشروع
        $project['gallery_images'] = $galleryImages;

        jsonResponse(true, "Project details fetched successfully", $project, 200);

    } 
    // ---------------------------------------------------
    // الحالة الثانية: لو مبعتش ID (جلب كل المشاريع المعتمدة للعرض العام)
    // ---------------------------------------------------
    else {
        
        $stmt = $pdo->query("
            SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) as designer_name
            FROM projects p
            JOIN designer_profiles dp ON p.designer_id = dp.id
            JOIN users u ON dp.user_id = u.id
            WHERE p.status = 'approved'
            ORDER BY p.id DESC
        ");
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // تحويل الروابط لكل المشاريع في القائمة
        foreach ($projects as &$item) {
            $item['cover_image_url'] = !empty($item['cover_image']) 
                ? rtrim(APP_URL, '/') . '/' . ltrim($item['cover_image'], '/') 
                : null;
        }

        jsonResponse(true, "All approved projects fetched successfully", $projects, 200);
    }

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}