<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../config/app.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";
require_once __DIR__ . "/../../core/auth.php"; // 🛡️ ملف الحماية الخاص بك

// 1. التأكد أن الطلب من نوع POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// 2. 🔐 فحص صلاحية الآدمن عبر السيرفر
$auth = requireAdmin(); 

// 3. استقبال البيانات (مع الحماية الذكية لقراءتها من الـ Body أو الـ URL)
$categoryId = intval($_POST['category_id'] ?? $_GET['category_id'] ?? 0);
$name = trim($_POST['name'] ?? $_GET['name'] ?? '');
$sortOrder = intval($_POST['sort_order'] ?? $_GET['sort_order'] ?? 1);

// التحقق من المدخلات الأساسية
if (empty($categoryId)) {
    jsonResponse(false, "Category ID is required", [], 400);
}
if (empty($name)) {
    jsonResponse(false, "Sub-category name is required", [], 400);
}

try {
    // 4. 🔍 التأكد أن القسم الرئيسي (Parent Category) موجود فعلاً في الداتا بيز
    $stmtCat = $pdo->prepare("SELECT id FROM categories WHERE id = ?");
    $stmtCat->execute([$categoryId]);
    if (!$stmtCat->fetch()) {
        jsonResponse(false, "Parent category not found", [], 404);
    }

    // 5. منع تكرار اسم القسم الفرعي داخل نفس القسم الرئيسي
    $stmtCheck = $pdo->prepare("SELECT id FROM sub_categories WHERE name = ? AND category_id = ?");
    $stmtCheck->execute([$name, $categoryId]);
    if ($stmtCheck->fetch()) {
        jsonResponse(false, "Sub-category name already exists in this category", [], 400);
    }

    // 6. توليد الـ slug تلقائياً
    $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $name)));
    if(empty($slug)) {
        // دعم الأسماء العربية في الـ slug
        $slug = str_replace(' ', '-', $name);
    }

    // 7. إدراج القسم الفرعي الجديد في جدول sub_categories
    $stmtInsert = $pdo->prepare("
        INSERT INTO sub_categories (category_id, name, slug, status, sort_order, created_at, updated_at) 
        VALUES (?, ?, ?, 'active', ?, NOW(), NOW())
    ");
    
    $stmtInsert->execute([$categoryId, $name, $slug, $sortOrder]);

    // الرد بالنجاح
    jsonResponse(true, "Sub-category created successfully", [
        "sub_category_id" => $pdo->lastInsertId(),
        "category_id" => $categoryId,
        "name" => $name,
        "slug" => $slug,
        "sort_order" => $sortOrder
    ], 201);

} catch (Exception $e) {
    jsonResponse(false, "Server Error", ["error" => $e->getMessage()], 500);
}