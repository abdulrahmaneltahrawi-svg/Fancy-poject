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

requireAdmin();

try {
    $stmt = $pdo->prepare("
        SELECT
            brands.id,
            brands.user_id,
            brands.brand_name,
            brands.brand_type,
            brands.email,
            brands.phone_code,
            brands.phone,
            brands.country,
            brands.city,
            brands.website,
            brands.description,
            brands.logo,
            brands.cover_image,
            brands.status,
            brands.created_at,

            users.first_name,
            users.last_name,
            users.email AS user_email,
            users.phone AS user_phone
        FROM brands
        INNER JOIN users ON users.id = brands.user_id
        WHERE brands.status = 'pending_admin_approval'
        ORDER BY brands.id DESC
    ");

    $stmt->execute();
    $brands = $stmt->fetchAll();

    jsonResponse(true, "Pending brands retrieved successfully", [
        "brands" => $brands,
        "count" => count($brands)
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}