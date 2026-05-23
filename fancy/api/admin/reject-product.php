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

$productId = (int)($input['product_id'] ?? 0);

if ($productId <= 0) {
    jsonResponse(false, "Product ID is required", [
        "code" => "PRODUCT_ID_REQUIRED"
    ], 422);
}

try {
    $stmt = $pdo->prepare("
        SELECT id, status
        FROM products
        WHERE id = ?
        LIMIT 1
    ");

    $stmt->execute([$productId]);
    $product = $stmt->fetch();

    if (!$product) {
        jsonResponse(false, "Product not found", [
            "code" => "PRODUCT_NOT_FOUND"
        ], 404);
    }

    if ($product['status'] === 'rejected') {
        jsonResponse(false, "Product is already rejected", [
            "code" => "PRODUCT_ALREADY_REJECTED"
        ], 409);
    }

    $stmt = $pdo->prepare("
        UPDATE products
        SET status = 'rejected'
        WHERE id = ?
    ");

    $stmt->execute([$productId]);

    jsonResponse(true, "Product rejected successfully", [
        "product_id" => $productId,
        "status" => "rejected"
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}