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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// حماية الـ API والتأكد من تسجيل الدخول
$auth = requireAuth();

function imageUrl($path)
{
    if (!$path) return null;
    return rtrim(APP_URL, '/') . '/' . ltrim($path, '/');
}

try {
    // التحديث هنا: دمج first_name و last_name معاً في متغير واحد اسمه user_name
    $stmt = $pdo->prepare("
        SELECT dp.*, CONCAT(u.first_name, ' ', u.last_name) as user_name, u.email as user_email 
        FROM designer_profiles dp
        JOIN users u ON dp.user_id = u.id
        WHERE dp.status = 'pending'
        ORDER BY dp.id DESC
    ");
    $stmt->execute();
    $designers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // جلب الخدمات لكل مصمم ممرر في اللستة
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

    jsonResponse(true, "Pending designers retrieved successfully", $designers, 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}