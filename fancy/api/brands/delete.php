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

$auth = requireAuth();

$input = getJsonInput();

$brandId = (int)($input['brand_id'] ?? 0);

if ($brandId <= 0) {
    jsonResponse(false, "Brand ID is required", [
        "code" => "BRAND_ID_REQUIRED"
    ], 422);
}

try {
    /*
    |--------------------------------------------------------------------------
    | 1. Check brand ownership
    |--------------------------------------------------------------------------
    */
    $stmt = $pdo->prepare("
        SELECT
            id,
            user_id,
            status
        FROM brands
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
    ");

    $stmt->execute([$brandId, $auth['user_id']]);
    $brand = $stmt->fetch();

    if (!$brand) {
        jsonResponse(false, "Brand not found or you do not have permission", [
            "code" => "BRAND_NOT_FOUND"
        ], 404);
    }

    if ($brand['status'] === 'deleted') {
        jsonResponse(false, "Brand is already deleted", [
            "code" => "BRAND_ALREADY_DELETED"
        ], 409);
    }

    /*
    |--------------------------------------------------------------------------
    | 2. Soft delete brand
    |--------------------------------------------------------------------------
    */
    $stmt = $pdo->prepare("
        UPDATE brands
        SET 
            status = 'deleted',
            deleted_at = NOW()
        WHERE id = ?
          AND user_id = ?
    ");

    $stmt->execute([$brandId, $auth['user_id']]);

    jsonResponse(true, "Brand deleted successfully", [
        "brand_id" => $brandId,
        "status" => "deleted"
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}