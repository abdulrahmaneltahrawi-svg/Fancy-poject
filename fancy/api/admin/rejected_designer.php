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

// العمليات التي تغير حالة في الداتا بيز نستخدم معها METHOD: POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// حماية الـ API والتحقق من التوكن الخاص بالأدمن
$auth = requireAuth();

// استقبال الـ designer_id من الـ Request Body
$designerId = (int)($_POST['designer_id'] ?? 0);

if (!$designerId) {
    jsonResponse(false, "Designer ID is required", ["code" => "VALIDATION_ERROR"], 422);
}

try {
    // 1. التحقق من وجود بروفايل المصمم في الداتا بيز أولاً
    $stmtCheck = $pdo->prepare("SELECT id FROM designer_profiles WHERE id = ? LIMIT 1");
    $stmtCheck->execute([$designerId]);
    if (!$stmtCheck->fetch()) {
        jsonResponse(false, "Designer profile not found", ["code" => "PROFILE_NOT_FOUND"], 404);
    }

    // 2. تحديث الحالة إلى مرفوض rejected
    $stmtUpdate = $pdo->prepare("UPDATE designer_profiles SET status = 'rejected' WHERE id = ?");
    $stmtUpdate->execute([$designerId]);

    // إرجاع رد النجاح للفرونت إند
    jsonResponse(true, "Designer profile rejected successfully", [
        "designer_id" => $designerId, 
        "status" => "rejected"
    ], 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}