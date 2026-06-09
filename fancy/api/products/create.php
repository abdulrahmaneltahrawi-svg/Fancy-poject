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

/*
|--------------------------------------------------------------------------
| 1. Upload Main Product Image Helper
|--------------------------------------------------------------------------
*/
function uploadProductImage($fileInputName)
{
    if (!isset($_FILES[$fileInputName]) || $_FILES[$fileInputName]['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    $file = $_FILES[$fileInputName];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(false, "File upload error", [
            "code" => "FILE_UPLOAD_ERROR",
            "field" => $fileInputName
        ], 400);
    }

    $maxSize = 3 * 1024 * 1024; // 3MB

    if ($file['size'] > $maxSize) {
        jsonResponse(false, "Image size must not exceed 3MB", [
            "code" => "IMAGE_TOO_LARGE",
            "field" => $fileInputName
        ], 422);
    }

    $allowedMimeTypes = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp'
    ];

    $mimeType = mime_content_type($file['tmp_name']);

    if (!array_key_exists($mimeType, $allowedMimeTypes)) {
        jsonResponse(false, "Only JPG, PNG and WEBP images are allowed", [
            "code" => "INVALID_IMAGE_TYPE",
            "field" => $fileInputName
        ], 422);
    }

    $extension = $allowedMimeTypes[$mimeType];
    $uploadDir = __DIR__ . "/../../uploads/products/";

    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0775, true);
    }

    $fileName = $fileInputName . "_" . time() . "_" . bin2hex(random_bytes(8)) . "." . $extension;
    $destination = $uploadDir . $fileName;

    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        jsonResponse(false, "Could not save uploaded image", [
            "code" => "IMAGE_SAVE_FAILED",
            "field" => $fileInputName
        ], 500);
    }

    return "uploads/products/" . $fileName;
}

/*
|--------------------------------------------------------------------------
| 2. Upload Option Image Helper (Throws Exception on failure for Transaction Safety)
|--------------------------------------------------------------------------
*/
function uploadOptionImage($index)
{
    if (!isset($_FILES['option_images']['name'][$index]) || $_FILES['option_images']['error'][$index] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    if ($_FILES['option_images']['error'][$index] !== UPLOAD_ERR_OK) {
        throw new Exception("Option image upload error at index $index", 400);
    }

    $maxSize = 3 * 1024 * 1024; // 3MB

    if ($_FILES['option_images']['size'][$index] > $maxSize) {
        throw new Exception("Option image size must not exceed 3MB at index $index", 422);
    }

    $allowedMimeTypes = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp'
    ];

    $tmpName = $_FILES['option_images']['tmp_name'][$index];
    $mimeType = mime_content_type($tmpName);

    if (!array_key_exists($mimeType, $allowedMimeTypes)) {
        throw new Exception("Only JPG, PNG and WEBP images are allowed for options (index $index)", 422);
    }

    $extension = $allowedMimeTypes[$mimeType];
    $uploadDir = __DIR__ . "/../../uploads/products/";

    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0775, true);
    }

    $fileName = "option_" . time() . "_" . bin2hex(random_bytes(8)) . "." . $extension;
    $destination = $uploadDir . $fileName;

    if (!move_uploaded_file($tmpName, $destination)) {
        throw new Exception("Could not save uploaded option image at index $index", 500);
    }

    return "uploads/products/" . $fileName;
}

/*
|--------------------------------------------------------------------------
| 3. Get Form-Data Inputs
|--------------------------------------------------------------------------
*/
$brandId = (int)($_POST['brand_id'] ?? 0);

$categoryId = isset($_POST['category_id']) && $_POST['category_id'] !== ''
    ? (int)$_POST['category_id']
    : null;

$subCategoryId = isset($_POST['sub_category_id']) && $_POST['sub_category_id'] !== ''
    ? (int)$_POST['sub_category_id']
    : null;

$requestedCategoryName = cleanInput($_POST['requested_category_name'] ?? '');
$requestedSubCategoryName = cleanInput($_POST['requested_sub_category_name'] ?? '');

$productName = cleanInput($_POST['product_name'] ?? '');
$shortDescription = cleanInput($_POST['short_description'] ?? '');
$description = cleanInput($_POST['description'] ?? '');
$technicalData = cleanInput($_POST['technical_data'] ?? '');

/*
|--------------------------------------------------------------------------
| 4. Main Validations
|--------------------------------------------------------------------------
*/
if ($brandId <= 0) {
    jsonResponse(false, "Brand ID is required", ["code" => "BRAND_ID_REQUIRED"], 422);
}

if ($productName === '') {
    jsonResponse(false, "Product name is required", ["code" => "PRODUCT_NAME_REQUIRED"], 422);
}

if ($categoryId === null && $requestedCategoryName === '') {
    jsonResponse(false, "Please select a category or enter requested category name", ["code" => "CATEGORY_REQUIRED"], 422);
}

if ($categoryId !== null && $subCategoryId === null && $requestedSubCategoryName === '') {
    jsonResponse(false, "Please select a sub category or enter requested sub category name", ["code" => "SUB_CATEGORY_REQUIRED"], 422);
}

try {
    /*
    |--------------------------------------------------------------------------
    | 5. Check Brand, Category & SubCategory Status
    |--------------------------------------------------------------------------
    */
    $stmt = $pdo->prepare("SELECT id, status FROM brands WHERE id = ? AND user_id = ? LIMIT 1");
    $stmt->execute([$brandId, $auth['user_id']]);
    $brand = $stmt->fetch();

    if (!$brand) {
        jsonResponse(false, "Brand not found or you do not have permission", ["code" => "BRAND_NOT_FOUND"], 404);
    }

    if ($brand['status'] !== 'active') {
        jsonResponse(false, "Brand must be active before adding products", ["code" => "BRAND_NOT_ACTIVE"], 403);
    }

    if ($categoryId !== null) {
        $stmt = $pdo->prepare("SELECT id FROM categories WHERE id = ? AND status = 'active' LIMIT 1");
        $stmt->execute([$categoryId]);
        if (!$stmt->fetch()) {
            jsonResponse(false, "Category not found", ["code" => "CATEGORY_NOT_FOUND"], 404);
        }
    }

    if ($categoryId !== null && $subCategoryId !== null) {
        $stmt = $pdo->prepare("SELECT id FROM sub_categories WHERE id = ? AND category_id = ? AND status = 'active' LIMIT 1");
        $stmt->execute([$subCategoryId, $categoryId]);
        if (!$stmt->fetch()) {
            jsonResponse(false, "Sub category not found or invalid", ["code" => "INVALID_SUB_CATEGORY"], 404);
        }
    }

    // Upload main image
    $mainImagePath = uploadProductImage('main_image');

    // Generate unique slug
    $baseSlug = createSlug($productName);
    $slug = $baseSlug;
    $counter = 1;
    while (true) {
        $stmt = $pdo->prepare("SELECT id FROM products WHERE slug = ? LIMIT 1");
        $stmt->execute([$slug]);
        if (!$stmt->fetch()) {
            break;
        }
        $slug = $baseSlug . "-" . $counter;
        $counter++;
    }

    /*
    |--------------------------------------------------------------------------
    | 6. Start Database Transaction
    |--------------------------------------------------------------------------
    */
    $pdo->beginTransaction();

    /*
    |--------------------------------------------------------------------------
    | 7. Insert Product
    |--------------------------------------------------------------------------
    */
    $stmt = $pdo->prepare("
        INSERT INTO products (
            user_id, brand_id, category_id, sub_category_id,
            requested_category_name, requested_sub_category_name,
            product_name, slug, short_description, description,
            technical_data, main_image, status
        ) VALUES (
            :user_id, :brand_id, :category_id, :sub_category_id,
            :requested_category_name, :requested_sub_category_name,
            :product_name, :slug, :short_description, :description,
            :technical_data, :main_image, 'pending_admin_approval'
        )
    ");

    $stmt->execute([
        ":user_id" => $auth['user_id'],
        ":brand_id" => $brandId,
        ":category_id" => $categoryId,
        ":sub_category_id" => $subCategoryId,
        ":requested_category_name" => $requestedCategoryName ?: null,
        ":requested_sub_category_name" => $requestedSubCategoryName ?: null,
        ":product_name" => $productName,
        ":slug" => $slug,
        ":short_description" => $shortDescription ?: null,
        ":description" => $description ?: null,
        ":technical_data" => $technicalData ?: null,
        ":main_image" => $mainImagePath
    ]);

    $productId = (int)$pdo->lastInsertId();

    /*
    |--------------------------------------------------------------------------
    | 8. Strict Loop and Insert Product Options
    |--------------------------------------------------------------------------
    */
    $options = $_POST['options'] ?? null;

    // فحص إذا كان الحقل مبعوث أصلاً
    if (empty($options)) {
        throw new Exception("حقل options لم يصل إلى السيرفر أو فارغ تماماً في الـ form-data", 422);
    }

    // محاولة فك الـ JSON لو مبعوت كنص (String) من Postman
    if (is_string($options)) {
        $decoded = json_decode($options, true);
        if ($decoded === null) {
            throw new Exception("فشل فك نص الـ JSON الخاص بالأوبشنز. تأكد من سلامة الأقواس وعلامات التنصيص: " . json_last_error_msg(), 422);
        }
        $options = $decoded;
    }

    // فحص أخير للتأكد من أنها أصبحت مصفوفة صالحة
    if (!is_array($options) || empty($options)) {
        throw new Exception("بيانات حقل options ليست مصفوفة صالحة للـ Loop", 422);
    }

    // اللوب الفعلي للإدخال في قاعدة البيانات
    foreach ($options as $index => $optionData) {
        
        $optionName = cleanInput($optionData['option_name'] ?? '');
        $typeSize   = cleanInput($optionData['type_size'] ?? '');
        $sku        = cleanInput($optionData['sku'] ?? '');
        $cbm        = cleanInput($optionData['cbm'] ?? '');

        if ($optionName === '') {
            throw new Exception("اسم الأوبشن (option_name) مطلوب ومفقود عند العنصر رقم $index", 422);
        }

        // رفع صورة الأوبشن المقابلة للـ index
        $optionImagePath = uploadOptionImage($index);

        $stmtOpt = $pdo->prepare("
            INSERT INTO product_options (
                product_id, option_name, type_size, sku, cbm, image_path
            ) VALUES (
                :product_id, :option_name, :type_size, :sku, :cbm, :image_path
            )
        ");

        $stmtOpt->execute([
            ":product_id"  => $productId,
            ":option_name" => $optionName,
            ":type_size"   => $typeSize ?: null,
            ":sku"         => $sku ?: null,
            ":cbm"         => $cbm ?: null,
            ":image_path"  => $optionImagePath
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | 9. Commit Transaction (نجاح كامل)
    |--------------------------------------------------------------------------
    */
    $pdo->commit();

    jsonResponse(true, "Product and its options created successfully.", [
        "product_id" => $productId,
        "slug" => $slug,
        "main_image" => $mainImagePath,
        "status" => "pending_admin_approval"
    ], 201);

} catch (Exception $e) {
    // التراجع الفوري عن أي حقول تم تخزينها لو حدث أي خطأ في أي مرحلة
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    $statusCode = ($e->getCode() >= 400 && $e->getCode() <= 500) ? $e->getCode() : 500;

    jsonResponse(false, $e->getMessage(), [
        "code" => "CREATION_FAILED"
    ], $statusCode);
}