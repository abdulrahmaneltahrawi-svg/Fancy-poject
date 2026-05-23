/**
 * auth.js - معالجة نظام تسجيل الدخول والحسابات
 */

// وظيفة لتغيير أزرار الهيدر (Login/Join) إلى اسم المستخدم عند تسجيل الدخول
function updateAuthUI() {
    const authLinks = document.querySelector('.auth-links');
    if (!authLinks) return;

    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            authLinks.innerHTML = `
                <a href="add-product.html" style="margin-left: 15px; font-size: 14px; font-weight: 600; color: #28a745; text-decoration: none;">➕ إضافة منتج</a>
                <a href="my-products.html" style="margin-left: 15px; font-size: 14px; font-weight: 600; color: #007bff; text-decoration: none;">📦 منتجاتي</a>
                <a href="#" id="profile-btn" style="margin-left: 15px; font-size: 14px; font-weight: 600; color: #000; text-decoration: none;">👤 حسابي</a>
                <a href="#" id="logout-btn" style="color: #d9534f; font-weight: bold;">خروج</a>
            `;
        } catch (e) {
            console.error('خطأ في قراءة بيانات المستخدم:', e);
        }
    }
}

function showAuthModal(type, email = '') {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.add('show');
    switchAuthTab(type);
    
    if (type === 'verify' && email) {
        const emailInput = document.querySelector('#emailVerificationForm input[name="email"]');
        if (emailInput) emailInput.value = email;
    }
    if (type === 'profile') {
        loadUserProfile();
    }
}

function switchAuthTab(type) {
    const loginSec = document.getElementById('loginSection');
    const regSec = document.getElementById('registerSection');
    const verifySec = document.getElementById('verifyEmailSection');
    const profileSec = document.getElementById('profileSection');
    const loginBtn = document.getElementById('showLogin');
    const regBtn = document.getElementById('showRegister');

    [loginSec, regSec, verifySec, profileSec].forEach(sec => sec?.classList.add('hidden'));
    [loginBtn, regBtn].forEach(btn => btn?.classList.remove('active'));

    if (type === 'login') {
        loginSec?.classList.remove('hidden');
        loginBtn?.classList.add('active');
    } else if (type === 'register') {
        regSec?.classList.remove('hidden');
        regBtn?.classList.add('active');
    } else if (type === 'verify') {
        verifySec?.classList.remove('hidden');
    } else if (type === 'profile') {
        profileSec?.classList.remove('hidden');
    }
}

async function loadUserProfile() {
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
        } else if (result?.code === 'UNAUTHORIZED') {
            localStorage.removeItem('userData');
            location.reload();
        }
    } catch (error) {
        displayMessage('profileMessage', 'خطأ في الاتصال بالسيرفر', false);
    }
}

async function resendVerificationCode(email) {
    displayMessage('emailVerificationMessage', 'جاري إعادة إرسال الرمز...', true);
    try {
        const result = await FancyAPI.post('/auth/resend-verification-code.php', { email });
        displayMessage('emailVerificationMessage', result.message, result.success);
    } catch (error) {
        displayMessage('emailVerificationMessage', 'خطأ في الاتصال بالسيرفر.', false);
    }
}

function displayMessage(elementId, message, isSuccess) {
    const messageDiv = document.getElementById(elementId);
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            color: ${isSuccess ? 'green' : 'red'};
            margin-top: 10px; padding: 8px; border-radius: 4px;
            border: 1px solid ${isSuccess ? 'green' : 'red'};
            background-color: ${isSuccess ? '#e6ffe6' : '#ffe6e6'};
        `;
    }
}

// دالة لتهيئة جميع معالجات الأحداث المتعلقة بالمصادقة
function initializeAuthListeners() {
    updateAuthUI(); // تحديث واجهة المستخدم فورًا عند التهيئة

    document.addEventListener('click', function (e) {
    const modal = document.getElementById('authModal');
    // console.log('Click event detected:', e.target); // يمكن تفعيل هذا السطر للتصحيح
    if (e.target.closest('.login-link')) {
        e.preventDefault();
        // console.log('Login link clicked!'); // يمكن تفعيل هذا السطر للتصحيح
        showAuthModal('login');
    } else if (e.target.closest('.join-link')) {
        e.preventDefault();
        // console.log('Join link clicked!'); // يمكن تفعيل هذا السطر للتصحيح
        showAuthModal('register');
    } else if (e.target.id === 'profile-btn') {
        e.preventDefault();
        showAuthModal('profile');
    } else if (e.target.id === 'logout-btn') {
        e.preventDefault();
        FancyAPI.post('/auth/logout.php').finally(() => {
            localStorage.removeItem('userData');
            location.reload();
        });
    } else if (e.target.id === 'resend-code') {
        e.preventDefault();
        const emailInput = document.querySelector('#emailVerificationForm input[name="email"]');
        if (emailInput?.value) resendVerificationCode(emailInput.value);
    } else if (e.target.classList.contains('close-modal') || e.target === modal) {
        modal?.classList.remove('show');
    } else if (e.target.id === 'showLogin') switchAuthTab('login');
    else if (e.target.id === 'showRegister') switchAuthTab('register');
    else if (e.target.id === 'backToLogin') {
        e.preventDefault();
        switchAuthTab('login');
    }
});

    document.addEventListener('submit', async (event) => {
    // التسجيل
    if (event.target.id === 'registrationForm') {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.target).entries());
        try {
            displayMessage('registrationMessage', 'جاري إرسال البيانات...', true);
            const result = await FancyAPI.post('/auth/register.php', data);
            console.log('Registration Response:', result);

            if (result?.success) {
                displayMessage('registrationMessage', result.message, true);
                event.target.reset();
                setTimeout(() => showAuthModal('verify', data.email), 2000);
            } else {
                displayMessage('registrationMessage', result.message || 'خطأ في التسجيل', false);
            }
        } catch (error) {
            displayMessage('registrationMessage', 'خطأ في الاتصال بالخادم.', false);
        }
    }

    // تسجيل الدخول
    if (event.target.id === 'loginForm') {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.target).entries());
        try {
            displayMessage('loginMessage', 'جاري تسجيل الدخول...', true);
            const result = await FancyAPI.post('/auth/login.php', data);
            if (result?.success) {
                displayMessage('loginMessage', result.message, true);
                localStorage.setItem('userData', JSON.stringify(result.data.user));
                setTimeout(() => location.reload(), 1500);
            } else {
                if (result.data?.code === "EMAIL_NOT_VERIFIED") {
                    showAuthModal('verify', data.email);
                }
                displayMessage('loginMessage', result.message || 'فشل الدخول', false);
            }
        } catch (error) {
            displayMessage('loginMessage', 'خطأ في الاتصال بالخادم.', false);
        }
    }

    // التحقق
    if (event.target.id === 'emailVerificationForm') {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.target).entries());
        try {
            const result = await FancyAPI.post('/auth/verify-email.php', data);
            if (result.success) {
                displayMessage('emailVerificationMessage', result.message + '. يمكنك الآن تسجيل الدخول.', true);
                event.target.reset();
                setTimeout(() => switchAuthTab('login'), 2000);
            } else {
                displayMessage('emailVerificationMessage', result.message || 'خطأ في التحقق', false);
            }
        } catch (error) {
            displayMessage('emailVerificationMessage', 'خطأ في الاتصال بالخادم.', false);
        }
    }
});
}

window.initializeAuthListeners = initializeAuthListeners; // جعل الدالة متاحة عالميًا