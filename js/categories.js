/**
 * categories.js - معالجة بيانات الأقسام (Categories)
 */

async function loadMainCategories(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const result = await FancyAPI.get('/categories/list.php');

        if (result && result.success && Array.isArray(result.data.categories)) {
            container.innerHTML = ""; 
            result.data.categories.forEach(cat => {
                const a = document.createElement('a');
                
                // التعديل هنا: الربط بصفحة القالب الموحد مباشرة
                // لا نحتاج للتحقق من أسماء الصفحات بعد الآن
                a.href = `product.category.html?id=${cat.id}`;
                a.textContent = cat.name;
                
                // اختيارياً: يمكنك ترك منطق التنبيه إذا كان القسم فارغاً 
                // (لكن يفضل التعامل معه داخل صفحة القالب الموحد نفسها)
                
                container.appendChild(a);
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// دالة استدعاء الأقسام الفرعية بناءً على اسم القسم أو المعرف
async function loadSubCategoriesForFilter(categoryParam, callback) {
    try {
        // تحديد ما إذا كان المعرف المرسل رقماً أم نصاً لتحديد اسم المعامل (Param)
        const paramName = isNaN(categoryParam) ? 'category_name' : 'category_id';
        
        // استدعاء ملف get-sub-categories.php
        const result = await FancyAPI.get(`/categories/get-sub-categories.php?${paramName}=${encodeURIComponent(categoryParam)}`);

        // السيرفر يعيد المصفوفة داخل result.data.sub_categories وليس result.data مباشرة
        const subCategories = result.data?.sub_categories;
        if (result && result.success && Array.isArray(subCategories)) {
            if (typeof callback === 'function') {
                callback(subCategories);
            }
            return subCategories;
        } else {
            console.warn(`No sub-categories found for: ${categoryParam}`);
            return [];
        }
    } catch (error) {
        console.error('Error fetching sub-categories:', error);
        throw error;
    }
}

window.loadMainCategories = loadMainCategories;
window.loadSubCategoriesForFilter = loadSubCategoriesForFilter;
