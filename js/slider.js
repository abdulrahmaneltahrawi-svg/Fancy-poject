// js/slider.js

async function loadSliderProducts() {
    try {
        // استخدام public-list.php لجلب المنتجات العامة
        const response = await FancyAPI.get('/products/public-list.php'); 
        
        if (response.success && response.data && response.data.products) {
            const products = response.data.products.slice(0, 6); // نأخذ أول 3 منتجات
            const container = document.getElementById('dynamic-slider');
            const dotsContainer = document.getElementById('dots-container');

            products.forEach((product, index) => {
                const productId = product.product_id || product.id || '';
                // إنشاء الشريحة
                const slide = document.createElement('div');
                slide.className = `slide ${index === 0 ? 'active' : ''}`;
                slide.innerHTML = `
                    <div class="slide-bg" style="background-image: url('${getSafeImageUrl(product.main_image)}');"></div>
                    <div class="slide-content">
                        <h1>${product.product_name}</h1>
                        <p>${product.short_description || ''}</p>
                        <a href="view.html?id=${productId}" class="btn" style="display: inline-block; margin-top: 20px; background: #fff; color: #000; padding: 10px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Product</a>
                    </div>
                `;
                container.appendChild(slide);

                // إنشاء النقاط
                const dot = document.createElement('span');
                dot.className = `dot ${index === 0 ? 'active' : ''}`;
                dotsContainer.appendChild(dot);
            });
            
            // هنا تقوم باستدعاء دالة تشغيل السلايدر (Slider Initialization)
            // ليتمكن الكود من تفعيل الأزرار والتبديل بين الشرائح الجديدة
            if (typeof initSlider === 'function') {
                initSlider();
            }
        }
    } catch (error) {
        console.error('Error loading slider:', error);
    }
}

window.loadSliderProducts = loadSliderProducts;