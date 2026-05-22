<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";
require_once __DIR__ . "/../../core/auth.php";

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, "Method not allowed", [], 405);
}

$auth = requireAuth();

try {
    $stmt = $pdo->prepare("
        SELECT
            id,
            brand_name,
            brand_type,
            email,
            phone_code,
            phone,
            country,
            city,
            website,
            description,
            logo,
            cover_image,
            status,
            created_at,
            updated_at
        FROM brands
        WHERE user_id = ?
        ORDER BY id DESC
    ");

    $stmt->execute([$auth['user_id']]);
    $brands = $stmt->fetchAll();

    jsonResponse(true, "Brands retrieved successfully", [
        "brands" => $brands,
        "has_brands" => count($brands) > 0
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}