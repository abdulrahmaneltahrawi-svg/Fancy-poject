// تعريف كائن FancyAPI لمعالجة طلبات الـ API بشكل موحد وتجنب تكرار الكود
if (typeof FancyAPI === 'undefined') {
    window.FancyAPI = {
    // تنبيه هام: GitHub Pages لا يدعم تشغيل ملفات PHP نهائياً.
    // لكي يعمل الموقع على GitHub، يجب رفع مجلد (fancy) على استضافة تدعم PHP 
    // (مثل InfinityFree, 000webhost, أو Hostinger) ثم وضع رابط الـ API الكامل هنا.
    baseUrl: (() => {
        const hostname = window.location.hostname;
        const origin = window.location.origin;
        const pathname = window.location.pathname;

        // 1. إذا كان الموقع مرفوعاً على GitHub Pages
        if (hostname.includes('github.io')) {
            return 'https://your-remote-php-server.com/fancy/api'; // استبدل هذا برابط سيرفر الـ PHP الحقيقي
        }

        // استخراج أجزاء المسار (نحذف اسم الملف HTML من النهاية)
        const fullPath = pathname.replace(/\/[^/]+\.html$/, '').replace(/\/$/, '');
        const pathSegments = fullPath.split('/').filter(segment => segment.length > 0);

        // 2. إذا كان الموقع يعمل محلياً (Localhost) أو عبر ngrok/tunnel في مجلد فرعي
        // نبحث عن مجلد المشروع (أول جزء في المسار لا يحتوي على نقطة)
        let projectFolder = '';
        if (pathSegments.length > 0 && !pathSegments[0].includes('.')) {
            projectFolder = pathSegments[0];
        }

        // 3. إذا وجدنا مجلد مشروع، نستخدمه. وإلا نستخدم المسار المباشر.
        if (projectFolder) {
            return `${origin}/${projectFolder}/fancy/api`;
        }

        // 4. الوضع الافتراضي (إذا كان الموقع في الجذر Root أو على استضافة مباشرة)
        return `${origin}/fancy/api`;
    })(),

    async request(endpoint, options = {}) {
        // تنظيف المسار لضمان عدم وجود سلاش مزدوج
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${this.baseUrl}${cleanEndpoint}`;
        
        console.log(`Sending ${options.method || 'GET'} request to: ${url}`);

        const headers = {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...options.headers,
        };

        // إضافة Content-Type فقط في حال كانت الطريقة ليست GET
        if (options.method && options.method !== 'GET' && !headers['Content-Type'] && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        try {
            // إضافة credentials: 'include' لضمان عمل الجلسات (Sessions)
            const response = await fetch(url, { ...options, headers, credentials: 'include' });
            const text = (await response.text()).trim();

            let result = {};
            try {
                result = text ? JSON.parse(text) : {};
            } catch (e) {
                const isHtml = text.trim().startsWith('<');
                
                if (isHtml && window.location.hostname.includes('github.io')) {
                    console.error("ERROR: GitHub Pages cannot execute PHP files. You need a remote PHP hosting for your API.");
                } else {
                    console.error(`Invalid JSON Response at [${endpoint}]:`, text);
                }

                const errorMsg = isHtml ? 'Server returned HTML instead of JSON (Check PHP/Path)' : 'Invalid server response';
                return { success: false, message: errorMsg, status: response.status, error: text };
            }

            // تصحيح: إذا كان الرد 200 أو 201 نعتبر العملية نجحت برمجياً ما لم يذكر السيرفر عكس ذلك
            const isSuccess = (response.ok && result.success !== false) || result.success === true;
            return { ok: response.ok, status: response.status, success: isSuccess, ...result };
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            return { success: false, message: 'An error occurred while connecting to the server' };
        }
    },
    get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
        post(endpoint, data) {
            const isFormData = data instanceof FormData;
            return this.request(endpoint, {
                method: 'POST',
                body: isFormData ? data : JSON.stringify(data)
            });
        }
    };
}

// دالة عالمية لتصحيح مسار الصور وضمان ظهورها
function getSafeImageUrl(imagePath) {
    if (!imagePath || imagePath === "null" || imagePath === "") {
        return "imges/img/fancy1.jfif"; // صورة افتراضية من شعار الموقع
    }
    // إذا كان رابط data: نرجعه كما هو
    if (imagePath.startsWith('data:')) return imagePath;

    // إذا كان الرابط يبدأ بـ http (قد يكون من API بـ APP_URL خطأ)
    if (imagePath.startsWith('http')) {
        // نحاول استخراج المسار النسبي من الرابط (أي شيء بعد /fancy/)
        const match = imagePath.match(/\/fancy\/(.+)$/);
        if (match) {
            // إعادة بناء الرابط باستخدام baseUrl الصحيح من FancyAPI
            const apiBase = FancyAPI.baseUrl.replace(/\/api\/?$/, ''); // يحذف /api من النهاية ليبقى /fancy
            return `${apiBase}/${match[1]}`;
        }
        // إذا لم نتمكن من استخراج مسار نسبي، نرجع الرابط كما هو
        return imagePath;
    }

    // تنظيف المسار لضمان عدم وجود سلاش بادئة
    const cleanPath = imagePath.replace(/^\//, '');
    const finalPath = cleanPath.startsWith('uploads/') ? cleanPath : `uploads/${cleanPath}`;

    // بما أن الصور تُرفع برمجياً داخل مجلد fancy/uploads (حسب كود PHP)
    // سنقوم باستخراج المجلد الأب من رابط الـ API لضمان الوصول للمسار الصحيح
    const apiBase = FancyAPI.baseUrl.replace(/\/api\/?$/, ''); // يحذف /api من النهاية ليبقى /fancy
    
    return `${apiBase}/${finalPath}`;
}
window.getSafeImageUrl = getSafeImageUrl;

// وظيفة لجلب ملف الهيدر وحقنه في الصفحة
function loadHeader() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    // استخدام مسار نسبي ليعمل على GitHub Pages بشكل صحيح
    fetch('components/header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Header file not found');
            }
            return response.text();
        })
        .then(data => {
            headerPlaceholder.innerHTML = data;
            // استدعاء تحديث الواجهة إذا كان ملف auth.js محلاً
            if (typeof window.initializeAuthListeners === 'function') {
                window.initializeAuthListeners(); // استدعاء دالة تهيئة المصادقة
            }
            // تهيئة البحث العام بعد تحميل الهيدر
            if (typeof window.initGlobalSearch === 'function') {
                window.initGlobalSearch();
            }
        })
        .catch(error => {
            console.error('Error loading header:', error);
        });
}

// تنفيذ الوظيفة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
    loadFooter();
});

// وظيفه جلب الارجل
function loadFooter() {
    fetch('components/footer.html')
        .then(res => {
            if (!res.ok) throw new Error('Failed to load footer');
            return res.text();
        })
        .then(data => {
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) {
                footerPlaceholder.innerHTML = data;
            }
        })
        .catch(error => {
            console.error('Error loading footer:', error);
        });
}
// نستخدم هذا الكود لضمان العمل حتى لو تم تحميل الهيدر بـ fetch
document.addEventListener('click', function (e) {
    const toggle = document.getElementById('dropdown-toggle');
    const menu = document.querySelector('.dropdown-menu');
    const selectedText = document.getElementById('selected-text');

    // القائمة المنسدلة (Categories)
    if (toggle && toggle.contains(e.target)) {
        menu.classList.toggle('show');
        toggle.classList.toggle('active');
    } else if (menu && menu.contains(e.target)) {
        const listItem = e.target.closest('li');
        if (listItem) {
            selectedText.innerText = listItem.innerText;
        }
        menu.classList.remove('show');
        toggle.classList.remove('active');
    } else if (toggle) {
        menu.classList.remove('show');
        toggle.classList.remove('active');
    }
});

// تفعيل خاصية البحث داخل القوائم المنسدلة (الفئات والماركات)
document.addEventListener('input', function (e) {
    if (e.target.classList.contains('search-input')) {
        const filter = e.target.value.toLowerCase();
        const dropdown = e.target.closest('.dropdown-content');
        if (!dropdown) return;

        const links = dropdown.querySelectorAll('a');
        links.forEach(link => {
            const text = link.textContent || link.innerText;
            if (text.toLowerCase().indexOf(filter) > -1) {
                link.style.display = "";
            } else {
                link.style.display = "none";
            }
        });
    }
});

// ================================================================
// 🌍 البحث العام (Global Search) عبر API
// ================================================================
// متغير لمنع إعادة تهيئة البحث أكثر من مرة (يمنع تكرار الأحداث)
let globalSearchInitialized = false;

function initGlobalSearch() {
    // إذا تمت التهيئة مسبقاً، لا تفعل شيئاً
    if (globalSearchInitialized) return;

    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    if (!searchInput || !searchResults) {
        // إذا لم تكن العناصر موجودة بعد (لأن الهيدر لم يُحمّل)، نعيد المحاولة لاحقاً
        setTimeout(initGlobalSearch, 500);
        return;
    }

    // منع التهيئة المتكررة
    globalSearchInitialized = true;
    let debounceTimer = null;

    // إخفاء القائمة عند النقر خارجها
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('show');
        }
    });

    // الاستماع لحدث الإدخال
    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        const query = searchInput.value.trim();

        if (query.length < 2) {
            searchResults.classList.remove('show');
            return;
        }

        debounceTimer = setTimeout(function() {
            performGlobalSearch(query);
        }, 300); // تأخير 300ms لتجنب الطلبات المتكررة
    });

    // الاستماع لمفتاح Escape لإغلاق النتائج
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            searchResults.classList.remove('show');
            searchInput.blur();
        }
    });

    async function performGlobalSearch(query) {
        try {
            const response = await FancyAPI.get(`Home/global_search.php?q=${encodeURIComponent(query)}`);
            
            if (!response.success) {
                searchResults.innerHTML = `<div class="search-result-error">${response.message || 'No results found'}</div>`;
                searchResults.classList.add('show');
                return;
            }

            const data = response.data || response;
            const brands = data.brands || [];
            const projects = data.projects || [];
            const products = data.products || [];

            // التحقق من وجود نتائج
            const total = brands.length + projects.length + products.length;
            if (total === 0) {
                searchResults.innerHTML = `<div class="search-result-empty">No results found for "<strong>${escapeHtml(query)}</strong>"</div>`;
                searchResults.classList.add('show');
                return;
            }

            // بناء HTML النتائج
            let html = '';

            // عرض البراندات
            if (brands.length > 0) {
                html += '<div class="search-result-category"><span>Brands</span></div>';
                brands.forEach(function(item) {
                    html += renderSearchItem(item, 'brand');
                });
            }

            // عرض المشاريع
            if (projects.length > 0) {
                html += '<div class="search-result-category"><span>Projects</span></div>';
                projects.forEach(function(item) {
                    html += renderSearchItem(item, 'project');
                });
            }

            // عرض المنتجات
            if (products.length > 0) {
                html += '<div class="search-result-category"><span>Products</span></div>';
                products.forEach(function(item) {
                    html += renderSearchItem(item, 'product');
                });
            }

            searchResults.innerHTML = html;
            searchResults.classList.add('show');

        } catch (error) {
            console.error('Search error:', error);
            searchResults.innerHTML = '<div class="search-result-error">Something went wrong</div>';
            searchResults.classList.add('show');
        }
    }

    function renderSearchItem(item, type) {
        // استخدام getSafeImageUrl لتصحيح مسار الصورة تلقائياً
        const imageUrl = getSafeImageUrl(item.image_url || item.image || '');
        const name = escapeHtml(item.name || 'Unknown');
        const pageLink = getPageLink(item, type);

        return `<a href="${pageLink}" class="search-result-item">
            <img src="${imageUrl}" alt="${name}" class="search-result-img" onerror="this.src='imges/img/fancy1.jfif'">
            <div class="search-result-info">
                <div class="search-result-name">${name}</div>
                <div class="search-result-type">${type}</div>
            </div>
        </a>`;
    }

    function getPageLink(item, type) {
        switch (type) {
            case 'brand':
                return `page_brand.html?id=${item.id}`;
            case 'project':
                return `page_magazine.html?id=${item.id}`;
            case 'product':
                return `page_prodact.html?id=${item.id}`;
            default:
                return '#';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }
}

// في حال تم تحميل الصفحة بدون الهيدر (مثل بعض الصفحات التي لا تستخدم header-placeholder)
// نحاول تهيئة البحث بعد تأخير بسيط
setTimeout(initGlobalSearch, 500);
