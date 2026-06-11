<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../config/app.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";

// ملف جلب بروفايل محدد يعمل بـ METHOD: GET ومتاح للعامة
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// استقبال الـ designer_id من الـ URL Parameter (مثال: get_profile.php?id=1)
$designerId = (int)($_GET['id'] ?? 0);

if (!$designerId) {
    jsonResponse(false, "Designer ID is required", ["code" => "VALIDATION_ERROR"], 422);
}

function imageUrl($path)
{
    if (!$path) return null;
    return rtrim(APP_URL, '/') . '/' . ltrim($path, '/');
}

try {
    // جلب بيانات بروفايل المصمم مع دمج الاسم الأول والأخير من جدول المستخدمين
    $stmt = $pdo->prepare("
        SELECT dp.*, CONCAT(u.first_name, ' ', u.last_name) as user_name, u.email as user_email 
        FROM designer_profiles dp
        JOIN users u ON dp.user_id = u.id
        WHERE dp.id = ? LIMIT 1
    ");
    $stmt->execute([$designerId]);
    $designer = $stmt->fetch(PDO::FETCH_ASSOC);

    // التحقق من وجود المصمم
    if (!$designer) {
        jsonResponse(false, "Designer profile not found", ["code" => "PROFILE_NOT_FOUND"], 404);
    }

    // تجهيز البيانات الرقمية وروابط الصور
    $designer['id'] = (int)$designer['id'];
    $designer['user_id'] = (int)$designer['user_id'];
    $designer['avatar_url'] = imageUrl($designer['avatar']);

    // جلب الخدمات (Tags) المرتبطة بهذا المصمم تحديداً
    $stmtServices = $pdo->prepare("
        SELECT s.id, s.name 
        FROM designer_services ds
        JOIN services s ON ds.service_id = s.id
        WHERE ds.designer_id = ?
    ");
    $stmtServices->execute([$designerId]);
    $designer['services'] = $stmtServices->fetchAll(PDO::FETCH_ASSOC);

    // إرجاع البيانات بنجاح
    jsonResponse(true, "Designer profile retrieved successfully", $designer, 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}