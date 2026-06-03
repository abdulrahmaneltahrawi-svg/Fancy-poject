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

requireAdmin();

$input = getJsonInput();

$brandId = (int)($input['brand_id'] ?? 0);

if ($brandId <= 0) {
    jsonResponse(false, "Brand ID is required", [
        "code" => "BRAND_ID_REQUIRED"
    ], 422);
}

try {
    $stmt = $pdo->prepare("
        SELECT id, status
        FROM brands
        WHERE id = ?
        LIMIT 1
    ");
    $stmt->execute([$brandId]);
    $brand = $stmt->fetch();

    if (!$brand) {
        jsonResponse(false, "Brand not found", [
            "code" => "BRAND_NOT_FOUND"
        ], 404);
    }

    if ($brand['status'] === 'rejected') {
        jsonResponse(false, "Brand is already rejected", [
            "code" => "BRAND_ALREADY_REJECTED"
        ], 409);
    }

    $stmt = $pdo->prepare("
        UPDATE brands
        SET status = 'rejected'
        WHERE id = ?
    ");
    $stmt->execute([$brandId]);

    jsonResponse(true, "Brand rejected successfully", [
        "brand_id" => $brandId,
        "status" => "rejected"
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}