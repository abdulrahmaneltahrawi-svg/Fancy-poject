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
        SELECT
            products.id,
            products.status,
            products.brand_id,
            brands.status AS brand_status
        FROM products
        INNER JOIN brands
            ON brands.id = products.brand_id
        WHERE products.id = ?
        LIMIT 1
    ");

    $stmt->execute([$productId]);
    $product = $stmt->fetch();

    if (!$product) {
        jsonResponse(false, "Product not found", [
            "code" => "PRODUCT_NOT_FOUND"
        ], 404);
    }

    if ($product['status'] === 'active') {
        jsonResponse(false, "Product is already active", [
            "code" => "PRODUCT_ALREADY_ACTIVE"
        ], 409);
    }

    if ($product['status'] === 'suspended') {
        jsonResponse(false, "Suspended product cannot be approved directly", [
            "code" => "PRODUCT_SUSPENDED"
        ], 400);
    }

    if ($product['brand_status'] !== 'active') {
        jsonResponse(false, "Product brand must be active before approving product", [
            "code" => "BRAND_NOT_ACTIVE",
            "brand_status" => $product['brand_status']
        ], 400);
    }

    $stmt = $pdo->prepare("
        UPDATE products
        SET status = 'active'
        WHERE id = ?
    ");

    $stmt->execute([$productId]);

    jsonResponse(true, "Product approved successfully", [
        "product_id" => $productId,
        "status" => "active"
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}