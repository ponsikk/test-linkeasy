import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';

// --- Конфигурация Теста ---
export const options = {
  vus: 20,
  duration: '10s',
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration{name:Login}': ['p(95)<800'],
    'http_req_duration{name:Register}': ['p(95)<1000'],
  },
};

// --- Базовые настройки ---
const BASE_URL = 'http://host.docker.internal:8080';

// --- Тестовые данные для загрузки аватара ---
// const avatarImage = open('./test-avatar.jpg', 'b'); // Раскомментируйте, если нужно

// --- Основной сценарий для каждого виртуального пользователя ---
export default function () {
  // --- Генерация уникальных данных для пользователя ---
  const uniqueId = `${__VU}-${__ITER}`;
  const username = `tes2222tusehgrdsaf111rr_11112322211232${uniqueId}`;
  const email = `te112312stasdfklke23sadfhgr_11${uniqueId}@test-linake2afffaaasssy.com`;
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
  let userId; 
  group('Step 2: User Login', function () {
    const loginPayload = JSON.stringify({ username: username, password: password });
    const res = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Login' },
    });
    
    // --- ДОБАВЬТЕ ЭТУ СТРОКУ ДЛЯ ДИАГНОСТИКИ ---
    console.log(`ОТВЕТ ОТ /api/auth/login: ${res.body}`);
    // ---------------------------------------------

    check(res, {
      'Login successful (status 200)': (r) => r.status === 200,
      'Response contains token': (r) => r.json('token') !== undefined,
      'Response contains userId': (r) => r.json('userId') !== undefined, 
    });
    
    authToken = res.json('token');
    userId = res.json('userId'); 
    
    if (!authToken || !userId) { 
        fail('Failed to get auth token or userId after login.'); 
    }
  });

  sleep(1);

  // =================================================================================
  // --- ДОБАВЛЕНО: Группа 3: Генерация QR-кода ---
  // =================================================================================
  let qrId; // Переменная для ID QR-кода (например, ef45f1ae-ab81-4044-a3e1-b0896f0b881f)
  group('Step 3: Generate QR Code', function () {
    const generatePayload = JSON.stringify({ url: `https://example.com/user/${userId}` });
    const res = http.post(`${BASE_URL}/api/v1/users/${userId}/generate-qr-code`, generatePayload, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        },
        tags: { name: 'GenerateQR' },
    });

    check(res, {
        'QR generation successful (200/201)': (r) => r.status === 200 || r.status === 201,
        'Response contains QR ID': (r) => r.json('id') !== undefined,
    });

    qrId = res.json('id'); // Предполагаем, что ID QR-кода лежит в поле 'id'
    if (!qrId) {
        fail(`Failed to extract QR ID from generation response. Body: ${res.body}`);
    }
  });

  sleep(1);
  
  // =================================================================================
  // --- ДОБАВЛЕНО: Группа 4: Получение QR-кода по ID ---
  // =================================================================================
  group('Step 4: Fetch QR Code by ID', function () {
    const res = http.get(`${BASE_URL}/api/v1/qr-code/${qrId}`, {
        headers: {
            'Authorization': `Bearer ${authToken}`,
        },
        tags: { name: 'FetchQR' },
    });

    check(res, {
        'QR fetch successful (200)': (r) => r.status === 200,
    });
  });
}