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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// حماية الـ API والتأكد من تسجيل الدخول
$auth = requireAuth();

function imageUrl($path)
{
    if (!$path) {
        return null;
    }
    return rtrim(APP_URL, '/') . '/' . ltrim($path, '/');
}

function deleteOldProductImage($path)
{
    if (!$path) {
        return;
    }
    $fullPath = __DIR__ . "/../../" . ltrim($path, '/');
    if (file_exists($fullPath) && is_file($fullPath)) {
        unlink($fullPath);
    }
}

function uploadProductImage($fileInputName)
{
    if (!isset($_FILES[$fileInputName]) || $_FILES[$fileInputName]['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    $file = $_FILES[$fileInputName];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(false, "File upload error", [
            "code" => "FILE_UPLOAD_ERROR",
            "field" => $fileInputName,
            "error_number" => $file['error']
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
            "field" => $fileInputName,
            "mime_type" => $mimeType
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
| استقبال البيانات الأساسية (Form-Data)
|--------------------------------------------------------------------------
*/
$productId = (int)($_POST['product_id'] ?? 0);
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
$technicalData = $_POST['technical_data'] ?? null; // استقبال البيانات التقنية الجديدة

if ($productId <= 0) {
    jsonResponse(false, "Product ID is required", ["code" => "PRODUCT_ID_REQUIRED"], 422);
}

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
    // بدء الـ Transaction لتأمين العمليات المشتركة
    $pdo->beginTransaction();

    /*
    |--------------------------------------------------------------------------
    | 1. التحقق من وجود المنتج، ملكيته وحالته الحالية
    |--------------------------------------------------------------------------
    */
    $stmt = $pdo->prepare("
        SELECT id, user_id, status, main_image 
        FROM products 
        WHERE id = ? AND user_id = ? AND status != 'deleted' 
        LIMIT 1
    ");
    $stmt->execute([$productId, $auth['user_id']]);
    $product = $stmt->fetch();

    if (!$product) {
        $pdo->rollBack();
        jsonResponse(false, "Product not found or you do not have permission", ["code" => "PRODUCT_NOT_FOUND"], 404);
    }

    if ($product['status'] === 'suspended') {
        $pdo->rollBack();
        jsonResponse(false, "Suspended product cannot be updated", ["code" => "PRODUCT_SUSPENDED"], 403);
    }

    /*
    |--------------------------------------------------------------------------
    | 2. التحقق من البراند والأقسام
    |--------------------------------------------------------------------------
    */
    $stmt = $pdo->prepare("SELECT id, status FROM brands WHERE id = ? AND user_id = ? LIMIT 1");
    $stmt->execute([$brandId, $auth['user_id']]);
    $brand = $stmt->fetch();

    if (!$brand) {
        $pdo->rollBack();
        jsonResponse(false, "Brand not found or you do not have permission", ["code" => "BRAND_NOT_FOUND"], 404);
    }

    if ($brand['status'] !== 'active') {
        $pdo->rollBack();
        jsonResponse(false, "Brand must be active before assigning products to it", ["code" => "BRAND_NOT_ACTIVE"], 403);
    }

    if ($categoryId !== null) {
        $stmt = $pdo->prepare("SELECT id FROM categories WHERE id = ? AND status = 'active' LIMIT 1");
        $stmt->execute([$categoryId]);
        if (!$stmt->fetch()) {
            $pdo->rollBack();
            jsonResponse(false, "Category not found", ["code" => "CATEGORY_NOT_FOUND"], 404);
        }
    }

    if ($categoryId !== null && $subCategoryId !== null) {
        $stmt = $pdo->prepare("SELECT id FROM sub_categories WHERE id = ? AND category_id = ? AND status = 'active' LIMIT 1");
        $stmt->execute([$subCategoryId, $categoryId]);
        if (!$stmt->fetch()) {
            $pdo->rollBack();
            jsonResponse(false, "Sub category not found or invalid", ["code" => "INVALID_SUB_CATEGORY"], 404);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | 3. رفع الصورة الرئيسية الجديدة (إن وجدت)
    |--------------------------------------------------------------------------
    */
    $newMainImagePath = uploadProductImage('main_image');
    $finalMainImagePath = $newMainImagePath ?: $product['main_image'];

    if ($newMainImagePath && $product['main_image']) {
        deleteOldProductImage($product['main_image']);
    }

    /*
    |--------------------------------------------------------------------------
    | 4. توليد الـ Slug الفريد للمنتج
    |--------------------------------------------------------------------------
    */
    $baseSlug = createSlug($productName);
    $slug = $baseSlug;
    $counter = 1;
    while (true) {
        $stmt = $pdo->prepare("SELECT id FROM products WHERE slug = ? AND id != ? LIMIT 1");
        $stmt->execute([$slug, $productId]);
        if (!$stmt->fetch()) {
            break;
        }
        $slug = $baseSlug . "-" . $counter;
        $counter++;
    }

    // تحديد حالة المنتج بعد التعديل
    $newStatus = $product['status'] === 'active' ? 'pending_admin_approval' : $product['status'];

    /*
    |--------------------------------------------------------------------------
    | 5. تحديث جدول المنتجات الرئيسي `products`
    |--------------------------------------------------------------------------
    */
    $stmt = $pdo->prepare("
        UPDATE products
        SET
            brand_id = :brand_id,
            category_id = :category_id,
            sub_category_id = :sub_category_id,
            requested_category_name = :requested_category_name,
            requested_sub_category_name = :requested_sub_category_name,
            product_name = :product_name,
            slug = :slug,
            short_description = :short_description,
            description = :description,
            technical_data = :technical_data,
            main_image = :main_image,
            status = :status
        WHERE id = :id AND user_id = :user_id
    ");

    $stmt->execute([
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
        ":main_image" => $finalMainImagePath,
        ":status" => $newStatus,
        ":id" => $productId,
        ":user_id" => $auth['user_id']
    ]);

    /*
    |--------------------------------------------------------------------------
    | 6. نظام مزامنة وتحديث الأوبشنز (Options Synchronization)
    |--------------------------------------------------------------------------
    */
    // جلب الأوبشنز الحالية المخزنة لهذا المنتج في قاعدة البيانات وفهرستها بالـ ID
    $stmtOldOptions = $pdo->prepare("SELECT id, image_path FROM product_options WHERE product_id = ?");
    $stmtOldOptions->execute([$productId]);
    $existingOptions = $stmtOldOptions->fetchAll(PDO::FETCH_ASSOC);
    $existingOptionsIndexed = array_column($existingOptions, null, 'id');

    // استقبال مصفوفة الأوبشنز القادمة من الفرونت إند (ممررة كـ JSON string أو مصفوفة عادية)
    $optionsRaw = $_POST['options'] ?? '[]';
    $options = is_string($optionsRaw) ? json_decode($optionsRaw, true) : $optionsRaw;
    if (!is_array($options)) {
        $options = [];
    }

    $processedOptionIds = [];

    foreach ($options as $index => $opt) {
        $optionId = isset($opt['id']) ? (int)$opt['id'] : 0;
        $optionName = cleanInput($opt['option_name'] ?? '');
        $typeSize = cleanInput($opt['type_size'] ?? '');
        $sku = cleanInput($opt['sku'] ?? '');
        $cbm = cleanInput($opt['cbm'] ?? '');

        // استقبال ورفع ملف الصورة الخاص بهذا الأوبشن بالتحديد (التسمية: option_image_0, option_image_1...)
        $optionFileKey = "option_image_" . $index;
        $newOptionImagePath = uploadProductImage($optionFileKey);

        if ($optionId > 0 && isset($existingOptionsIndexed[$optionId])) {
            // [أ] الأوبشن موجود مسبقاً -> نقوم بتحديث بياناته الحاليّة
            $processedOptionIds[] = $optionId;
            $oldOptionImagePath = $existingOptionsIndexed[$optionId]['image_path'];
            $finalOptionImagePath = $newOptionImagePath ?: $oldOptionImagePath;

            $stmtUpdateOpt = $pdo->prepare("
                UPDATE product_options 
                SET option_name = ?, type_size = ?, sku = ?, cbm = ?, image_path = ?
                WHERE id = ? AND product_id = ?
            ");
            $stmtUpdateOpt->execute([$optionName, $typeSize, $sku, $cbm, $finalOptionImagePath, $optionId, $productId]);

            // لو تم رفع صورة جديدة للأوبشن الحالي، نمسح القديمة فوراً لتوفير مساحة السيرفر
            if ($newOptionImagePath && $oldOptionImagePath) {
                deleteOldProductImage($oldOptionImagePath);
            }
        } else {
            // [ب] الأوبشن غير موجود (جديد) -> نقوم بإدراجه كسطر جديد
            $stmtInsertOpt = $pdo->prepare("
                INSERT INTO product_options (product_id, option_name, type_size, sku, cbm, image_path)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmtInsertOpt->execute([$productId, $optionName, $typeSize, $sku, $cbm, $newOptionImagePath]);
        }
    }

    // [ج] حذف الأوبشنز المستبعدة: أي أوبشن مسجل مسبقاً لم يرسله الفرونت إند يتم حذفه تلقائياً
    foreach ($existingOptionsIndexed as $oldId => $oldOpt) {
        if (!in_array($oldId, $processedOptionIds)) {
            if ($oldOpt['image_path']) {
                deleteOldProductImage($oldOpt['image_path']);
            }
            $stmtDeleteOpt = $pdo->prepare("DELETE FROM product_options WHERE id = ?");
            $stmtDeleteOpt->execute([$oldId]);
        }
    }

    // تأكيد حفظ كافة العمليات في قاعدة البيانات بنجاح
    $pdo->commit();

    jsonResponse(true, "Product and options updated successfully", [
        "product_id" => $productId,
        "slug" => $slug,
        "main_image" => $finalMainImagePath,
        "main_image_url" => imageUrl($finalMainImagePath),
        "status" => $newStatus
    ], 200);

} catch (Exception $e) {
    // في حالة حدوث أي خطأ، يتم التراجع عن كافة العمليات فوراً لحماية البيانات
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse(false, "Something went wrong during update", [
        "code" => "SERVER_ERROR",
        "error" => $e->getMessage()
    ], 500);
}