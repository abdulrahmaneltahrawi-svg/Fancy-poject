<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../config/app.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";

// ملف عرض عام للزوار يشتغل بـ GET ولا يشترط توكن حماية (Auth) لكي يراه الجميع
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, "Method not allowed", [], 405);
}

function imageUrl($path)
{
    if (!$path) return null;
    return rtrim(APP_URL, '/') . '/' . ltrim($path, '/');
}

try {
    // جلب المصممين المقبولين فقط (approved) مع دمج الاسم الأول والأخير
    $stmt = $pdo->prepare("
        SELECT dp.*, CONCAT(u.first_name, ' ', u.last_name) as user_name, u.email as user_email 
        FROM designer_profiles dp
        JOIN users u ON dp.user_id = u.id
        WHERE dp.status = 'approved'
        ORDER BY dp.id DESC
    ");
    $stmt->execute();
    $designers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // جلب الخدمات (الوسوم) لكل مصمم مقبول
    foreach ($designers as &$designer) {
        $designer['id'] = (int)$designer['id'];
        $designer['user_id'] = (int)$designer['user_id'];
        $designer['avatar_url'] = imageUrl($designer['avatar']);

        $stmtServices = $pdo->prepare("
            SELECT s.id, s.name 
            FROM designer_services ds
            JOIN services s ON ds.service_id = s.id
            WHERE ds.designer_id = ?
        ");
        $stmtServices->execute([$designer['id']]);
        $designer['services'] = $stmtServices->fetchAll(PDO::FETCH_ASSOC);
    }

    jsonResponse(true, "Approved designers retrieved successfully", $designers, 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}