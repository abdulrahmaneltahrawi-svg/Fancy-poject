<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . "/../../core/cors.php";
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../config/app.php";
require_once __DIR__ . "/../../core/response.php";
require_once __DIR__ . "/../../core/helpers.php";
require_once __DIR__ . "/../../core/auth.php"; // 🛡️ استدعاء ملف الحماية بتاعك هنا

// 1. التأكد أن الطلب من نوع POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, "Method not allowed", [], 405);
}

// 2. 🔐 سطر الحماية السحري من محرك السيستم بتاعك
// الدالة دي لوحدها بتشيك على السيشن، ولو مش آدمن بتطرد برة بـ 403 أو 401 تلقائي بالـ JSON اللي أنت مجهزه
$auth = requireAdmin(); 
$adminId = $auth['user_id']; // لو احتجت الـ ID بتاع الآدمن اللي ضاف القسم موجود معاك هنا

try {
    // 3. استقبال البيانات المدخلة من الـ Admin
    $name = trim($_POST['name'] ?? '');
    $sortOrder = intval($_POST['sort_order'] ?? 1); // القيمة الافتراضية 1

    // التحقق من أن الاسم مش فارغ
    if (empty($name)) {
        jsonResponse(false, "Category name is required", [], 400);
    }

    // 4. منع تكرار اسم القسم في جدول categories
    $stmtCheck = $pdo->prepare("SELECT id FROM categories WHERE name = ?");
    $stmtCheck->execute([$name]);
    if ($stmtCheck->fetch()) {
        jsonResponse(false, "Category name already exists", [], 400);
    }

    // 5. توليد الـ slug تلقائياً من الاسم
    $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $name)));
    if(empty($slug)) {
        // دعم الأسماء العربية في الـ slug
        $slug = str_replace(' ', '-', $name);
    }

    // 6. إدراج القسم الجديد في قاعدة البيانات
    $stmtInsert = $pdo->prepare("
        INSERT INTO categories (name, slug, status, sort_order, created_at, updated_at) 
        VALUES (?, ?, 'active', ?, NOW(), NOW())
    ");
    
    $stmtInsert->execute([$name, $slug, $sortOrder]);

    // الرد بالنجاح
    jsonResponse(true, "Category created successfully", [
        "category_id" => $pdo->lastInsertId(),
        "name" => $name,
        "slug" => $slug,
        "sort_order" => $sortOrder
    ], 201);

} catch (Exception $e) {
    jsonResponse(false, "Server Error", ["error" => $e->getMessage()], 500);
}