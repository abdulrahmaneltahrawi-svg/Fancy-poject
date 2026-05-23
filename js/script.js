// تعريف كائن FancyAPI لمعالجة طلبات الـ API بشكل موحد وتجنب تكرار الكود
const FancyAPI = {
    baseUrl: '/Fancy-Design/fancy/api',
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
        };

        try {
            const response = await fetch(url, { ...options, headers });
            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (e) {
                // في حال رجوع خطأ PHP أو استجابة ليست JSON
                return { success: false, message: 'استجابة غير صالحة من السيرفر', status: response.status, error: text };
            }
            return { ok: response.ok, status: response.status, ...result };
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            return { success: false, message: 'حدث خطأ في الاتصال بالسيرفر' };
        }
    },
    get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
    post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); }
};

// وظيفة لجلب ملف الهيدر وحقنه في الصفحة
function loadHeader() {
    // استخدام مسار يبدأ بـ / لضمان العمل من أي صفحة
    fetch('/Fancy-Design/components/header.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('لم يتم العثور على ملف الهيدر');
            }
            return response.text();
        })
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;
            updateAuthUI(); // تحديث أزرار تسجيل الدخول بناءً على حالة المستخدم
        })
        .catch(error => {
            console.error('حدث خطأ أثناء تحميل الهيدر:', error);
        });
}

// وظيفة لتغيير أزرار الهيدر (Login/Join) إلى اسم المستخدم عند تسجيل الدخول
function updateAuthUI() {
    const authLinks = document.querySelector('.auth-links');
    if (!authLinks) return;

    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            authLinks.innerHTML = `
                <a href="#" id="profile-btn" style="margin-left: 15px; font-size: 14px; font-weight: 600; color: #000; text-decoration: none;">👤 حسابي</a>
                <a href="#" id="logout-btn" style="color: #d9534f; font-weight: bold;">خروج</a>
            `;
        } catch (e) {
            console.error('خطأ في قراءة بيانات المستخدم:', e);
        }
    }
}

// تنفيذ الوظيفة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
    loadFooter();
});

// وظيفه جلب الارجل
function loadFooter() {
    fetch('/Fancy-Design/components/footer.html')
        .then(res => {
            if (!res.ok) throw new Error('فشل تحميل الفوتر');
            return res.text();
        })
        .then(data => {
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) {
                footerPlaceholder.innerHTML = data;
            }
        })
        .catch(error => {
            console.error('حدث خطأ أثناء تحميل الفوتر:', error);
        });
}
// نستخدم هذا الكود لضمان العمل حتى لو تم تحميل الهيدر بـ fetch
document.addEventListener('click', function (e) {
    const toggle = document.getElementById('dropdown-toggle');
    const menu = document.querySelector('.dropdown-menu');
    const selectedText = document.getElementById('selected-text');
    const modal = document.getElementById('authModal');

    // القائمة المنسدلة (Categories)
    if (toggle && toggle.contains(e.target)) {
        menu.classList.toggle('show');
        toggle.classList.toggle('active');
    } else if (menu && menu.contains(e.target) && e.target.tagName === 'LI') {
        selectedText.innerText = e.target.innerText;
        menu.classList.remove('show');
        toggle.classList.remove('active');
    } else if (toggle) {
        menu.classList.remove('show');
        toggle.classList.remove('active');
    }

    // فتح النافذة عند الضغط على Login أو Join
    if (e.target.closest('.login-link')) {
        e.preventDefault();
        showAuthModal('login');
    } else if (e.target.closest('.join-link')) {
        e.preventDefault();
        showAuthModal('register');
    }

    // فتح الملف الشخصي
    if (e.target.id === 'profile-btn') {
        e.preventDefault();
        showAuthModal('profile');
    }

    // معالجة الضغط على زر تسجيل الخروج
    if (e.target.id === 'logout-btn') {
        e.preventDefault();
        // استدعاء API تسجيل الخروج لتنظيف الجلسة في السيرفر
        FancyAPI.get('/auth/logout.php')
            .finally(() => {
                localStorage.removeItem('userData'); // حذف البيانات محلياً
                location.reload(); // إعادة تحميل الصفحة
            });
    }

    // إعادة إرسال رمز التحقق
    if (e.target.id === 'resend-code') {
        e.preventDefault();
        const emailInput = document.querySelector('#emailVerificationForm input[name="email"]');
        if (emailInput && emailInput.value) {
            resendVerificationCode(emailInput.value);
        }
    }

    // إغلاق النافذة
    if (e.target.classList.contains('close-modal') || e.target === modal) {
        modal.classList.remove('show');
    }

    // التبديل داخل النافذة
    if (e.target.id === 'showLogin') switchAuthTab('login');
    if (e.target.id === 'showRegister') switchAuthTab('register');

    // العودة لتسجيل الدخول من شاشة التحقق
    if (e.target.id === 'backToLogin') {
        e.preventDefault();
        switchAuthTab('login');
    }
});

function showAuthModal(type, email = '') { // Added email parameter
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.add('show');
    switchAuthTab(type);
    // Pre-fill email if type is 'verify'
    if (type === 'verify' && email) {
        const emailInput = document.querySelector('#emailVerificationForm input[name="email"]');
        if (emailInput) {
            emailInput.value = email;
        }
    }
    // Load profile data if type is 'profile'
    if (type === 'profile') {
        loadUserProfile();
    }
}

function switchAuthTab(type) {
    const loginSec = document.getElementById('loginSection');
    const regSec = document.getElementById('registerSection');
    const verifySec = document.getElementById('verifyEmailSection'); // Get the new verification section
    const profileSec = document.getElementById('profileSection');
    const loginBtn = document.getElementById('showLogin');
    const regBtn = document.getElementById('showRegister');
    // No button for 'verify' tab, as it's usually triggered by login flow

    // Hide all sections first
    loginSec.classList.add('hidden');
    regSec.classList.add('hidden');
    if (verifySec) verifySec.classList.add('hidden'); // Ensure verification section is hidden
    if (profileSec) profileSec.classList.add('hidden');

    // Deactivate all buttons
    loginBtn.classList.remove('active');
    regBtn.classList.remove('active');

    if (type === 'login') {
        loginSec.classList.remove('hidden');
        loginBtn.classList.add('active');
    } else if (type === 'register') {
        regSec.classList.remove('hidden');
        loginBtn.classList.remove('active');
        regBtn.classList.add('active');
    } else if (type === 'verify') { // Handle 'verify' type
        if (verifySec) verifySec.classList.remove('hidden');
        // No active button for 'verify' as it's a flow-triggered state
    } else if (type === 'profile') {
        if (profileSec) profileSec.classList.remove('hidden');
    }
}

// وظيفة جلب بيانات المستخدم من me.php
async function loadUserProfile() {
    const profileData = document.getElementById('profileData');
    const profileMsg = document.getElementById('profileMessage');
    
    try {
        const result = await FancyAPI.get('/auth/me.php');

        if (result && result.success) {
            const user = result.data.user;
            document.getElementById('prof-name').textContent = `${user.first_name} ${user.last_name}`;
            document.getElementById('prof-email').textContent = user.email;
            document.getElementById('prof-phone').textContent = user.phone || 'غير مسجل';
            document.getElementById('prof-type').textContent = user.account_type;
            document.getElementById('prof-status').textContent = user.status;
            document.getElementById('prof-date').textContent = new Date(user.created_at).toLocaleDateString('ar-SA');
            profileMsg.textContent = '';
        } else if (result) {
            displayMessage('profileMessage', 'فشل جلب البيانات: ' + result.message, false);
            if (result.code === 'UNAUTHORIZED') {
                localStorage.removeItem('userData');
                location.reload();
            }
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
        displayMessage('profileMessage', 'خطأ في الاتصال بالسيرفر', false);
    }
}

// وظيفة إعادة إرسال الرمز
async function resendVerificationCode(email) {
    const msgDiv = 'emailVerificationMessage';
    displayMessage(msgDiv, 'جاري إعادة إرسال الرمز...', true);
    try {
        const result = await FancyAPI.post('/auth/resend-verification-code.php', { email: email });
        
        if (result.success) {
            displayMessage(msgDiv, result.message || 'تم إرسال رمز جديد لبريدك.', true);
        } else {
            displayMessage(msgDiv, result.message || 'فشل إعادة الإرسال.', false);
        }
    } catch (error) {
        console.error('Error resending code:', error);
        displayMessage(msgDiv, 'خطأ في الاتصال بالسيرفر.', false);
    }
}

// Helper function to display messages (يمكن تحسينها بعناصر واجهة مستخدم أفضل)
function displayMessage(elementId, message, isSuccess) {
    const messageDiv = document.getElementById(elementId);
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.style.color = isSuccess ? 'green' : 'red';
        messageDiv.style.marginTop = '10px';
        messageDiv.style.padding = '8px';
        messageDiv.style.border = `1px solid ${isSuccess ? 'green' : 'red'}`;
        messageDiv.style.borderRadius = '4px';
        messageDiv.style.backgroundColor = isSuccess ? '#e6ffe6' : '#ffe6e6';
    }
}

// معالجة إرسال النماذج للـ PHP باستخدام Event Delegation
document.addEventListener('submit', async (event) => {
    // معالجة إنشاء الحساب
    if (event.target.id === 'registrationForm') {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());
        try {
            displayMessage('registrationMessage', 'جاري إرسال البيانات...', true);

            const result = await FancyAPI.post('/auth/register.php', data);

            if (result && result.success) {
                displayMessage('registrationMessage', result.message, true);
                event.target.reset();
                // الانتقال تلقائياً لقسم التحقق بعد ثانيتين من النجاح
                setTimeout(() => {
                    showAuthModal('verify', data.email);
                    const regMsg = document.getElementById('registrationMessage');
                    if (regMsg) regMsg.textContent = ''; 
                }, 2000);
            } else if (result) {
                const errorMessage = result.message || 'حدث خطأ غير معروف.';
                const errorCode = result.data && result.data.code ? ` (${result.data.code})` : '';
                displayMessage('registrationMessage', errorMessage + errorCode, false);
            }
        } catch (error) {
            displayMessage('registrationMessage', 'حدث خطأ أثناء الاتصال بالخادم. تفقد الكونسول لمزيد من التفاصيل.', false);
            console.error('Network or server error during registration:', error);
        }
    }
    // معالجة تسجيل الدخول
    if (event.target.id === 'loginForm') {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());
        try {
            // تسجيل البيانات المرسلة للتصحيح
            console.log('Sending login data:', data);
            const result = await FancyAPI.post('/auth/login.php', data);

            if (result && result.success) {
                displayMessage('loginMessage', result.message, true);
                localStorage.setItem('userData', JSON.stringify(result.data.user));
                // إغلاق النافذة بعد ثانية واحدة من النجاح
                setTimeout(() => { 
                    location.reload(); // إعادة تحميل الصفحة لتحديث حالة الهيدر
                }, 1500);
            } else {
                const errorMessage = result.message || 'حدث خطأ غير معروف.';
                // If login fails due to unverified email, switch to verification tab
                if (result.data && result.data.code === "EMAIL_NOT_VERIFIED") {
                    showAuthModal('verify', data.email); // Pass the email to pre-fill the verification form
                }
                const errorCode = result.data && result.data.code ? ` (${result.data.code})` : '';
                displayMessage('loginMessage', errorMessage + errorCode, false);
            }
        } catch (error) {
            displayMessage('loginMessage', 'حدث خطأ أثناء الاتصال بالخادم. تفقد الكونسول لمزيد من التفاصيل.', false);
            console.error('Network or server error during login:', error);
        }
    }

    // New: Handle email verification form submission
    if (event.target.id === 'emailVerificationForm') {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());
        try {
            // تسجيل البيانات المرسلة للتصحيح - تحقق من أسماء الحقول هنا
            console.log('Sending verification data:', data);

            const result = await FancyAPI.post('/auth/verify-email.php', data);

            if (result.success) {
                displayMessage('emailVerificationMessage', result.message + '. يمكنك الآن تسجيل الدخول.', true);
                event.target.reset();
                // Optionally, switch back to login tab after successful verification
                setTimeout(() => {
                    switchAuthTab('login');
                    displayMessage('emailVerificationMessage', '', true); // Clear message
                }, 2000);
            } else {
                const errorMessage = result.message || 'حدث خطأ غير معروف أثناء التحقق.';
                const errorCode = result.data && result.data.code ? ` (${result.data.code})` : '';
                displayMessage('emailVerificationMessage', errorMessage + errorCode, false);
            }
        } catch (error) {
            displayMessage('emailVerificationMessage', 'حدث خطأ أثناء الاتصال بالخادم للتحقق من البريد الإلكتروني.', false);
            console.error('Network or server error during email verification:', error);
        }
    }
});
