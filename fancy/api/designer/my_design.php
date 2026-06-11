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

// ملفات جلب البيانات يفضل دائماً أن تكون بـ METHOD: GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// حماية الـ API وجلب بيانات المستخدم الحالي من التوكن
$auth = requireAuth();

function imageUrl($path)
{
    if (!$path) {
        return null;
    }
    return rtrim(APP_URL, '/') . '/' . ltrim($path, '/');
}

try {
    // 1. جلب بيانات بروفايل المصمم بناءً على الـ user_id للمستخدم المسجل حالياً
    $stmtProfile = $pdo->prepare("SELECT * FROM designer_profiles WHERE user_id = ? LIMIT 1");
    $stmtProfile->execute([$auth['user_id']]);
    $profile = $stmtProfile->fetch(PDO::FETCH_ASSOC);

    // 2. إذا لم يكن لدى المستخدم بروفايل مصمم بعد، نرسل رد مخصص ليقوم الفرونت إند بتحويله لصفحة الإنشاء
    if (!$profile) {
        jsonResponse(false, "You don't have a designer profile yet.", ["code" => "PROFILE_NOT_FOUND"], 404);
    }

    $designerId = (int)$profile['id'];

    // 3. جلب جميع الخدمات المرتبطة بهذا المصمم (أسماء الـ tags وأرقامها) من خلال الـ JOIN
    $stmtServices = $pdo->prepare("
        SELECT s.id, s.name 
        FROM designer_services ds
        JOIN services s ON ds.service_id = s.id
        WHERE ds.designer_id = ?
    ");
    $stmtServices->execute([$designerId]);
    $services = $stmtServices->fetchAll(PDO::FETCH_ASSOC);

    // تحويل أنواع البيانات الرقمية لضمان قراءتها بشكل صحيح في الفرونت إند
    $profile['id'] = (int)$profile['id'];
    $profile['user_id'] = (int)$profile['user_id'];
    $profile['avatar_url'] = imageUrl($profile['avatar']);

    // دمج مصفوفة الخدمات داخل داتا البروفايل للتبسيط
    $profile['services'] = $services;

    // إرسال البيانات بنجاح
    jsonResponse(true, "Designer profile retrieved successfully", $profile, 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}