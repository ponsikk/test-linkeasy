import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';

// --- Конфигурация Теста ---
export const options = {
  vus: 50,
  duration: '5m',
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration{name:Login}': ['p(95)<800'],
    'http_req_duration{name:Register}': ['p(95)<1000'],
  },
};

// --- Базовые настройки ---
const BASE_URL = 'http://host.docker.internal:8080';

// --- Тестовые данные для загрузки аватара ---
const avatarImage = open('./test-avatar.jpg', 'b');

// --- Основной сценарий для каждого виртуального пользователя ---
export default function () {
  // --- Генерация уникальных данных для пользователя ---
  const uniqueId = `${__VU}-${__ITER}`;
  const username = `tes2tuser111rr_11122211232${uniqueId}`;
  const email = `testuase23r_11${uniqueId}@test-linke2afffsssy.com`;
  const password = 'Password123!';
  const newPassword = 'NewPassword456!';

  // =================================================================================
  // Группа 1: Регистрация
  // =================================================================================
  group('Step 1: User Registration', function () {
    const registerPayload = JSON.stringify({ username: username, email: email, password: password, confirmPassword: password });
    const res = http.post(`${BASE_URL}/api/auth/register`, registerPayload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Register' },
    });
    check(res, { 'Registration successful (status 200 or 201)': (r) => r.status === 200 || r.status === 201 });
  });

  sleep(1);

  // =================================================================================
  // Группа 2: Вход и получение токена
  // =================================================================================
  let authToken;
  group('Step 2: User Login', function () {
    const loginPayload = JSON.stringify({ username: username, password: password });
    const res = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Login' },
    });
    check(res, {
      'Login successful (status 200)': (r) => r.status === 200,
      'Response contains token': (r) => r.json('token') !== undefined,
    });
    authToken = res.json('token');
    if (!authToken) { fail('Failed to get auth token after login.'); }
  });

  sleep(1);

  // =================================================================================
  // Группа 3: Все действия аутентифицированного пользователя
  // =================================================================================
  if (authToken) {
    // Всю логику после логина лучше поместить в одну большую группу для чистоты отчетов
    group('Step 3: Authenticated User Actions', function() {
        
        const authJsonHeaders = {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
        };

        // --- Действия с дашбордом и страницей ---
        http.get(`${BASE_URL}/api/dashboard/data`, { headers: authJsonHeaders, tags: { name: 'GetDashboardData' } });
        http.get(`${BASE_URL}/api/page`, { headers: authJsonHeaders, tags: { name: 'GetPageSettings' } });

        // --- Загрузка аватара ---
        const avatarPayload = { avatarFile: http.file(avatarImage, 'test-avatar.jpg', 'image/jpeg') };
        const avatarHeaders = { 'Authorization': `Bearer ${authToken}` };
        const avatarRes = http.post(`${BASE_URL}/api/dashboard/avatar`, avatarPayload, { headers: avatarHeaders, tags: { name: 'UploadAvatar' }});
        check(avatarRes, {
            'Upload avatar successful (status 200)': (r) => r.status === 200,
            'Avatar response contains avatarUrl': (r) => r.json('avatarUrl') !== undefined,
        });

        sleep(1);

        // --- Управление ссылками ---
        let newLinkId;
        const createLinkPayload = JSON.stringify({ title: `My Test Link ${uniqueId}`, url: `https://test-link.com/${uniqueId}` });
        const createLinkRes = http.post(`${BASE_URL}/api/links`, createLinkPayload, { headers: authJsonHeaders, tags: { name: 'CreateLink' } });
        check(createLinkRes, { 'Create link successful (status 200)': (r) => r.status === 200 });
        if (createLinkRes.status === 200) { newLinkId = createLinkRes.json('id'); }

        if (newLinkId) {
            sleep(1);
            const updateLinkPayload = JSON.stringify({
                  title: `Updated Link ${uniqueId}`,
                  url: `https://updated-link.com/${uniqueId}` // Добавили недостающее поле URL
              });
            http.put(`${BASE_URL}/api/links/${newLinkId}`, updateLinkPayload, { headers: authJsonHeaders, tags: { name: 'UpdateLink' } });
            sleep(1);
            http.del(`${BASE_URL}/api/links/${newLinkId}`, null, { headers: authJsonHeaders, tags: { name: 'DeleteLink' } });
        }
        
        sleep(1);

        // --- Подписка и безопасность ---
        http.post(`${BASE_URL}/api/subscription/upgrade`, null, { headers: authJsonHeaders, tags: { name: 'UpgradeSubscription' } });

        const changePasswordPayload = JSON.stringify({ currentPassword: password, newPassword: newPassword });
        http.post(`${BASE_URL}/api/dashboard/change-password`, changePasswordPayload, { headers: authJsonHeaders, tags: { name: 'ChangePassword' } });

        sleep(1);

        // --- ИСПРАВЛЕНИЕ ЗДЕСЬ: Проверка входа с новым паролем ---
        const newLoginPayload = JSON.stringify({ username: username, password: newPassword });
        const newLoginParams = { headers: { 'Content-Type': 'application/json' }, tags: { name: 'LoginWithNewPassword' } };
        const newLoginRes = http.post(`${BASE_URL}/api/auth/login`, newLoginPayload, newLoginParams);
        
        check(newLoginRes, {
            'Login with new password successful (status 200)': (r) => r.status === 200,
            'Login with new password returned a new token': (r) => r.json('token') !== undefined,
        });

        const newAuthToken = newLoginRes.json('token');
        if (newAuthToken) {
            authToken = newAuthToken;
        }
    });
  }

  sleep(2);
}