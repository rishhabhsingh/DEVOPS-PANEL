@echo off
echo Starting DevOps Panel...

echo Checking Redis...
docker start redis-devops 2>nul || docker run -d --name redis-devops --restart always -p 6379:6379 redis:alpine

echo.
echo Redis ready. Now start these in separate terminals:
echo   Terminal 1: cd backend ^&^& node index.js
echo   Terminal 2: cd worker ^&^& node src/worker.js  
echo   Terminal 3: cd frontend ^&^& npm run dev
echo.
pause