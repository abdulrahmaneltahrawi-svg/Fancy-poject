<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";
require_once __DIR__ . "/../../core/auth.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// حماية الـ API والتأكد من تسجيل الدخول
$auth = requireAuth();

// استقبال البيانات كـ JSON
$input = getJsonInput();
$productId = (int)($input['product_id'] ?? 0);

if ($productId <= 0) {
    jsonResponse(false, "Product ID is required", [
        "code" => "PRODUCT_ID_REQUIRED"
    ], 422);
}

try {
    /*
    |--------------------------------------------------------------------------
    | 1. التحقق من وجود المنتج، ملكيته للمستخدم، وحالته الحالية
    |--------------------------------------------------------------------------
    */
    $stmt = $pdo->prepare("
        SELECT id, status 
        FROM products 
        WHERE id = ? AND user_id = ? 
        LIMIT 1
    ");

    $stmt->execute([$productId, $auth['user_id']]);
    $product = $stmt->fetch();

    // إذا لم يعثر على المنتج أو كان تابع لمستخدم آخر
    if (!$product) {
        jsonResponse(false, "Product not found or you do not have permission", [
            "code" => "PRODUCT_NOT_FOUND"
        ], 404);
    }

    // إذا كان المنتج ممسوح سوفت بالفعل من قبل
    if ($product['status'] === 'deleted') {
        jsonResponse(false, "Product is already deleted", [
            "code" => "PRODUCT_ALREADY_DELETED"
        ], 409);
    }

    /*
    |--------------------------------------------------------------------------
    | 2. تنفيذ الـ Soft Delete (تحديث الحالة وتوقيت الحذف)
    |--------------------------------------------------------------------------
    */
    $updateStmt = $pdo->prepare("
        UPDATE products 
        SET 
            status = 'deleted', 
            deleted_at = NOW() 
        WHERE id = ? AND user_id = ?
    ");

    $updateStmt->execute([$productId, $auth['user_id']]);

    // رد بالنجاح مع الحفاظ على البيانات في السيرفر وقاعدة البيانات
    jsonResponse(true, "Product soft-deleted successfully", [
        "product_id" => $productId,
        "status" => "deleted"
    ], 200);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong during deletion", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}