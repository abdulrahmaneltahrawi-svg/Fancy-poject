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

// 1. التأكد أن الطلب من نوع POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// 2. التحقق من صلاحيات الأدمن (إذا كنت تفحص التوكن)
// $auth = requireAuth(); 

try {
    // 3. استقبال البيانات (مع دعم الكابيتال والسمول والمسافات لراحة التستنج)
    $projectId = (int)($_POST['project_id'] ?? $_POST['Project_Id'] ?? $_POST['projectId'] ?? 0);
    $status    = trim(strtolower($_POST['status'] ?? $_POST['Status'] ?? ''));

    // 4. التحقق من صحة المدخلات
    if (empty($projectId) || empty($status)) {
        jsonResponse(false, "Project ID and Status are required", ["code" => "VALIDATION_ERROR"], 422);
    }

    // تم التعديل هنا: السماح بخيارين فقط (approved أو rejected)
    $allowedStatuses = ['approved', 'rejected'];
    if (!in_array($status, $allowedStatuses)) {
        jsonResponse(false, "Invalid status. Allowed values are: approved, rejected", ["code" => "INVALID_STATUS"], 422);
    }

    // 5. التأكد من وجود المشروع أصلاً في قاعدة البيانات
    $stmtCheck = $pdo->prepare("SELECT id FROM projects WHERE id = ? LIMIT 1");
    $stmtCheck->execute([$projectId]);
    if (!$stmtCheck->fetch()) {
        jsonResponse(false, "Project not found", ["code" => "NOT_FOUND"], 404);
    }

    // 6. تحديث حالة المشروع في جدول projects
    $stmtUpdate = $pdo->prepare("
        UPDATE projects 
        SET status = ? 
        WHERE id = ?
    ");
    $stmtUpdate->execute([$status, $projectId]);

    // 7. رد النجاح للأدمن والفرونت إند
    jsonResponse(true, "Project status updated successfully to " . $status, [
        "project_id" => $projectId,
        "status"     => $status
    ], 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", ["code" => "SERVER_ERROR", "error" => $e->getMessage()], 500);
}