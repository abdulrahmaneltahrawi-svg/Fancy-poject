<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../config/app.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, "Method not allowed", [], 405);
}

function imageUrl($path)
{
    if (!$path) {
        return null;
    }

    return rtrim(APP_URL, '/') . '/' . ltrim($path, '/');
}

$search = cleanInput($_GET['search'] ?? '');

try {
    $sql = "
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
        WHERE status = 'active'
    ";

    $params = [];

    if ($search !== '') {
        $sql .= "
            AND (
                brand_name LIKE ?
                OR brand_type LIKE ?
                OR country LIKE ?
                OR city LIKE ?
                OR description LIKE ?
            )
        ";

        $searchTerm = "%" . $search . "%";

        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }

    $sql .= " ORDER BY id DESC ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $brands = $stmt->fetchAll();

    foreach ($brands as &$brand) {
        $brand['id'] = (int)$brand['id'];
        $brand['logo_url'] = imageUrl($brand['logo']);
        $brand['cover_image_url'] = imageUrl($brand['cover_image']);
    }

    jsonResponse(true, "Active brands retrieved successfully", [
        "brands" => $brands,
        "count" => count($brands)
    ]);

} catch (Exception $e) {
    jsonResponse(false, "Something went wrong", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}