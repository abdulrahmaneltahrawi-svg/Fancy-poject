/**
 * auth.js - معالجة نظام تسجيل الدخول والحسابات
 */

// كائن خدمة البريد الإلكتروني لعزل منطق الإرسال عن منطق الحسابات
const EmailService = {
    // استبدل هذه القيم بمفاتيحك الحقيقية من لوحة تحكم EmailJS
    // تأكد أن هذه القيم ليست 'service_id_here' أو 'template_id_here'
    CONFIG: {
        SERVICE_ID: 'service_id_here', 
        TEMPLATE_ID: 'template_id_here'
    },

    sendVerification: async function(userName, userEmail, code) {
        if (this.CONFIG.SERVICE_ID === 'service_id_here' || this.CONFIG.TEMPLATE_ID === 'template_id_here') {
            console.error('EmailJS Error: SERVICE_ID or TEMPLATE_ID are still placeholders. Please replace them in js/auth.js.');
            return Promise.reject({ text: 'خطأ في إعدادات EmailJS: المفاتيح غير صحيحة.' });
        }

        const params = { user_name: userName, user_email: userEmail, verification_code: code };
        console.log('Attempting to send email via EmailService...', params);
        console.log('EmailJS Config:', this.CONFIG); // لعرض المفاتيح المستخدمة في الكونسول
        return emailjs.send(this.CONFIG.SERVICE_ID, this.CONFIG.TEMPLATE_ID, params);
    }
};

// وظيفة لتغيير أزرار الهيدر (Login/Join) إلى اسم المستخدم عند تسجيل الدخول
function updateAuthUI() {
    const authLinks = document.querySelector('.auth-links');
    if (!authLinks) return;

    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            authLinks.innerHTML = `
                <div class="user-menu-wrapper" style="position: relative;">
                    <button id="user-menu-toggle" class="user-name-btn">
                        ${user.first_name} ${user.last_name}
                        <i class="arrow-down"></i>
                    </button>
                    <div id="user-dropdown-list" class="dropdown-menu user-dropdown">
                        ${(user.account_type === 'designer' || user.account_type === 'brand') ? 
                            '<a href="add-product.html"><li>إضافة منتج</li></a>' : ''}
                        <a href="profile.html"><li>ملفي الشخصي</li></a>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 5px 0;">
                        <a href="#" id="logout-btn"><li style="color: #d9534f;">تسجيل الخروج</li></a>
                    </div>
                </div>
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
            // تحديث البيانات المحلية بالبيانات الأحدث من السيرفر
            localStorage.setItem('userData', JSON.stringify(user));
            
            if (document.getElementById('prof-name')) 
            document.getElementById('prof-name').textContent = `${user.first_name} ${user.last_name}`;
            if (document.getElementById('prof-email')) document.getElementById('prof-email').textContent = user.email;
            if (document.getElementById('prof-phone')) document.getElementById('prof-phone').textContent = user.phone || 'غير مسجل';
            if (document.getElementById('prof-type')) document.getElementById('prof-type').textContent = user.account_type;
            if (document.getElementById('prof-status')) document.getElementById('prof-status').textContent = user.status;
            
            const dateElem = document.getElementById('prof-date');
            if (dateElem) {
                const joinDate = user.created_at || user.registration_date;
                dateElem.textContent = joinDate 
                    ? new Date(joinDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'غير متوفر';
            }
        } else if (result?.code === 'UNAUTHORIZED') {
            localStorage.removeItem('userData');
            location.reload();
        }
    } catch (error) {
        displayMessage('profileMessage', 'خطأ في الاتصال بالسيرفر', false);
    }
}

async function logoutUser() {
    try {
        // استدعاء API تسجيل الخروج لإنهاء الجلسة في السيرفر
        await FancyAPI.post('/auth/logout.php');
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // مسح بيانات المستخدم محلياً وإعادة التوجيه للرئيسية
        localStorage.removeItem('userData');
        window.location.href = 'index.html';
    }
}

async function resendVerificationCode(email) {
    displayMessage('emailVerificationMessage', 'جاري إعادة إرسال الرمز...', true);
    try {
        const result = await FancyAPI.post('/auth/resend-verification-code.php', { email });
        console.log('Resend API Response:', result); // لمساعدتك في تتبع البيانات في الكونسول
        
        // --- رمز تحقق مؤقت وغير آمن للاختبار فقط (لا تستخدمه في بيئة إنتاجية) ---
        // بما أن ملفات PHP الحالية لا تعيد الرمز في استجابة JSON،
        // سنستخدم رمزاً ثابتاً مؤقتاً لاختبار عمل EmailJS.
        // يجب تعديل ملفات PHP لتعيد الرمز الحقيقي ليكون الحل آمناً.
        const token = result.data?.token_code || result.data?.verification_code || "332211"; // رمز ثابت مؤقت لإعادة الإرسال
        // --- نهاية الرمز المؤقت ---

        if (result.success) {
            if (!result.data?.token_code) {
                console.warn('Warning: No token_code received from server for resend. Using a temporary hardcoded token for EmailJS testing.');
            }

            // إرسال الكود الجديد (المؤقت) عبر EmailJS
            EmailService.sendVerification(result.data.first_name || 'User', email, token)
                .then(() => {
                    displayMessage('emailVerificationMessage', 'تم إرسال رمز جديد بنجاح إلى بريدك.', true);
                })
                .catch(err => {
                    console.error('EmailJS Resend Error:', err);
                    displayMessage('emailVerificationMessage', 'تم توليد الرمز ولكن فشل الإرسال عبر البريد. تأكد من إعدادات EmailJS.', false);
                });
        } else {
            displayMessage('emailVerificationMessage', result.message || 'فشل إعادة إرسال الرمز.', false);
        }

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
    } else if (e.target.closest('#user-menu-toggle')) {
        e.preventDefault();
        const menu = document.getElementById('user-dropdown-list');
        menu.classList.toggle('show');
        e.target.closest('#user-menu-toggle').classList.toggle('active');
    } else if (e.target.closest('#logout-btn')) {
        e.preventDefault();
        logoutUser();
    } else if (e.target.id === 'resend-code') {
        e.preventDefault();
        const emailInput = document.querySelector('#emailVerificationForm input[name="email"]');
        if (emailInput?.value) resendVerificationCode(emailInput.value);
    } else if (e.target.classList.contains('close-modal') || e.target === modal) {
        modal?.classList.remove('show');
    } else if (e.target.closest('#showLogin') || e.target.closest('#backToLogin')) {
        e.preventDefault();
        switchAuthTab('login');
    } else if (e.target.closest('#showRegister')) {
        e.preventDefault();
        switchAuthTab('register');
    } else if (!e.target.closest('.user-menu-wrapper')) {
        // إغلاق القائمة عند النقر في أي مكان آخر
        document.getElementById('user-dropdown-list')?.classList.remove('show');
        document.getElementById('user-menu-toggle')?.classList.remove('active');
    }
}); // نهاية مستمع أحداث النقر

    document.addEventListener('submit', async (event) => {
    // التسجيل
    if (event.target.id === 'registrationForm') {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.target).entries());
        const regMsgId = 'registrationMessage';

        try {
            displayMessage(regMsgId, 'جاري إرسال البيانات...', true);
            const result = await FancyAPI.post('/auth/register.php', data);
            
            console.log('Server Response:', result); // فحص رد السيرفر في الكونسول

            if (result?.success) {
                // التحقق من وجود الكود قبل الإرسال
                const token = result.data?.token_code || result.data?.verification_code;
                
                // --- رمز تحقق مؤقت وغير آمن للاختبار فقط (لا تستخدمه في بيئة إنتاجية) ---
                // بما أن ملفات PHP الحالية لا تعيد الرمز في استجابة JSON،
                // سنستخدم رمزاً ثابتاً مؤقتاً لاختبار عمل EmailJS.
                // يجب تعديل ملفات PHP لتعيد الرمز الحقيقي ليكون الحل آمناً.
                const testToken = token || "122333"; // رمز ثابت مؤقت
                // --- نهاية الرمز المؤقت ---

                if (!token) {
                    console.warn('Warning: No token_code received from server. Using a temporary hardcoded token for EmailJS testing.');
                    // لا نخرج هنا، بل نواصل باستخدام الرمز المؤقت
                }

                // استخدام الـ EmailService بدلاً من الاستدعاء المباشر
                EmailService.sendVerification(data.first_name, data.email, testToken)
                    .then(() => {
                        console.log('EmailService: Success');
                        displayMessage(regMsgId, 'تم التسجيل! أرسلنا رمز التحقق إلى بريدك الإلكتروني (رمز الاختبار: ' + testToken + ').', true);
                        
                        // الانتقال لصفحة التحقق
                        // ملاحظة: بما أن الرمز ثابت، يمكن للمستخدم إدخال 122333 للتحقق
                        // ولكن هذا غير آمن ويجب استبداله بالرمز الحقيقي من PHP
                        // بعد تعديل ملفات PHP لتعيد الرمز.

                        setTimeout(() => {
                            event.target.reset();
                            showAuthModal('verify', data.email);
                        }, 2000);
                    })
                    .catch((err) => {
                        console.error('EmailJS Failed Error:', err);
                        displayMessage(regMsgId, 'خطأ في خدمة الإيميل: ' + (err.text || 'تأكد من إعدادات EmailJS والمفاتيح'), false);
                    });
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
            console.log('Login API Response:', result); // أضف هذا السطر
            if (result?.success) {
                displayMessage('loginMessage', result.message, true);
                localStorage.setItem('userData', JSON.stringify(result.data.user));
                setTimeout(() => location.reload(), 1500);
            } else {
                // إذا كان السبب هو عدم تفعيل البريد، ننتقل لواجهة التحقق
                if (result.data?.code === "EMAIL_NOT_VERIFIED") {
                    showAuthModal('verify', data.email);
                    displayMessage('emailVerificationMessage', result.message, false);
                } else {
                    displayMessage('loginMessage', result.message || 'فشل الدخول', false);
                }
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