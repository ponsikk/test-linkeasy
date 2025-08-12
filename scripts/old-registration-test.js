import http from 'k6/http';
import { check, sleep } from 'k6';

// --- Настройки теста ---
export const options = {
  stages: [
    // Плавно наращиваем нагрузку до 50 одновременных регистраций в секунду
    { duration: '30s', target: 50 }, 
    // Держим эту нагрузку в течение 1 минуты
    { duration: '1m', target: 50 },  
    // Плавно снижаем нагрузку
    { duration: '10s', target: 0 },  
  ],
  thresholds: {
    // Тест будет считаться проваленным, если ошибок больше 1%
    'http_req_failed': ['rate<0.01'], 
    // 95% запросов на регистрацию должны выполняться быстрее, чем за 1 секунду (1000ms)
    'http_req_duration': ['p(95)<1000'], 
  },
};

// --- Основной сценарий теста ---
export default function () {
  // Эндпоинт для регистрации в твоем главном сервисе
  const url = 'http://host.docker.internal:8080/api/auth/register';

  // --- ГЕНЕРАЦИЯ УНИКАЛЬНЫХ ДАННЫХ ДЛЯ КАЖДОГО ПОЛЬЗОВАТЕЛЯ ---
  // k6 предоставляет специальные переменные:
  // __VU: уникальный номер виртуального пользователя (от 1 до 50 в нашем случае)
  // __ITER: номер итерации (попытки) для каждого пользователя
  const uniqueId = `${__VU}-${__ITER}`;
  const username = `testuser_7777345245399995${uniqueId}`;
  const email = `testuser_7${uniqueId}@testtеееsssu.comm`;
  const password = 'Password123!';

  // Формируем тело запроса
  const payload = JSON.stringify({
    username: username,
    email: email,
    password: password,
    confirmPassword: password // Убедись, что твой DTO ожидает это поле
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Отправляем POST-запрос на регистрацию
  const res = http.post(url, payload, params);

  // Проверяем, что ответ сервера успешный (код 200 или 201)
  check(res, { 'Регистрация успешна (статус 200/201)': (r) => r.status === 200 || r.status === 201 });
  
  // Небольшая пауза, чтобы не перегружать систему слишком сильно
  sleep(1); 
}