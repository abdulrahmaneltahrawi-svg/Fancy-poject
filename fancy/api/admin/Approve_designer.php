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

// ملفات التعديل والأكشن دائماً بـ METHOD: POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// حماية الـ API والتحقق من التوكن (الأدمن)
$auth = requireAuth();

// استقبال الـ designer_id من الـ Request Body
$designerId = (int)($_POST['designer_id'] ?? 0);

if (!$designerId) {
    jsonResponse(false, "Designer ID is required", ["code" => "VALIDATION_ERROR"], 422);
}

try {
    // 1. التحقق من وجود بروفايل المصمم أولاً في الداتا بيز
    $stmtCheck = $pdo->prepare("SELECT id FROM designer_profiles WHERE id = ? LIMIT 1");
    $stmtCheck->execute([$designerId]);
    if (!$stmtCheck->fetch()) {
        jsonResponse(false, "Designer profile not found", ["code" => "PROFILE_NOT_FOUND"], 404);
    }

    // 2. تحديث حالة المصمم إلى مقبول approved ليظهر في العرض العام للموقع
    $stmtUpdate = $pdo->prepare("UPDATE designer_profiles SET status = 'approved' WHERE id = ?");
    $stmtUpdate->execute([$designerId]);

    // إرجاع رد النجاح للفرونت إند
    jsonResponse(true, "Designer profile approved successfully", [
        "designer_id" => $designerId, 
        "status" => "approved"
    ], 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}