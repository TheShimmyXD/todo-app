# Windows 11

Cómo levantar y desarrollar el proyecto en Windows 11, con PowerShell. Hay dos caminos, igual que en Linux: todo con Docker Desktop, o la base en Docker y la API y la web con Node instalado en Windows.

> **Comprobado en Windows 11 Pro** (Windows PowerShell 5.1, Git para Windows con `core.autocrlf=true`, Docker Desktop 4.96.3, Node 24.22.1) desde un clon limpio: checkout sin CRLF, la opción A completa (`docker compose up --build -d` en 90 s, `/health`, crear, editar, filtrar y eliminar por la web y por la API, tildes y ñ guardadas en UTF-8) y, de la opción B, `npm ci`, `db:deploy`, lint, typecheck, las 31 pruebas del backend y el build del frontend. `npm run dev` no se probó en Windows.

Todas las órdenes son para **PowerShell** y funcionan igual en Windows PowerShell 5.1 (el que trae Windows) y en PowerShell 7. Por eso cada orden va en su propia línea: PowerShell 5.1 no entiende `&&`.

## Requisitos

| Programa | Instalación | Comprobación |
|---|---|---|
| Git | `winget install --id Git.Git -e` | `git --version` |
| Docker Desktop (con WSL 2) | `winget install --id Docker.DockerDesktop -e`, reinicia y abre Docker Desktop una vez | `docker compose version` |
| Node.js 24 LTS (solo para desarrollar fuera de Docker) | Instalador de la versión 24 desde https://nodejs.org/en/download | `node --version` → `v24.…` |

- Docker Desktop usa WSL 2 y necesita la virtualización activada en la BIOS. **En una máquina virtual** con Windows 11, además, la virtualización anidada tiene que estar activada en el hipervisor del anfitrión; sin ella Docker Desktop no arranca.
- Si `npm` responde «la ejecución de scripts está deshabilitada en este sistema», permite los scripts firmados para tu usuario (una sola vez):

  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```

  Node instala `npm.ps1`, y la política por defecto de Windows bloquea los scripts de PowerShell. La alternativa, sin cambiar la política, es escribir `npm.cmd` y `npx.cmd` en lugar de `npm` y `npx`.

## Finales de línea

El repositorio guarda todo con LF, y `.gitattributes` obliga a que el checkout también sea LF, aunque Git para Windows tenga `core.autocrlf=true`. No hace falta configurar nada. Si tu editor no lee `.editorconfig`, configúralo para guardar con LF (en VS Code, `"files.eol": "\n"`).

## Opción A: todo con Docker Desktop

```powershell
git clone <url-del-repositorio> todo-app
cd todo-app
docker compose up --build -d
docker compose ps -a
```

`docker compose ps -a` debe mostrar `db` y `backend` *(healthy)*, `frontend` *Up* y `migrate` *Exited (0)*. Web en http://localhost:3000 y API en http://localhost:4000. No hace falta `.env`.

## Opción B: desarrollar con Node en Windows

Primera vez, desde la raíz del repositorio:

```powershell
Copy-Item .env.example .env
docker compose up -d db
cd backend
npm ci
npm run db:deploy
cd ..\frontend
npm ci
cd ..
```

Después, una terminal para cada proceso:

```powershell
# Terminal 1
cd backend
npm run dev                  # http://localhost:4000

# Terminal 2
cd frontend
npm run dev                  # http://localhost:3000
```

Las demás órdenes del README valen tal cual en PowerShell, con dos diferencias:

| En bash (README) | En PowerShell |
|---|---|
| `cp .env.example .env` | `Copy-Item .env.example .env` |
| `curl localhost:4000/health` | `curl.exe http://localhost:4000/health` (`curl` sin `.exe` es otro comando en PowerShell 5.1) |
| `docker compose exec -T db psql -U todo -d todo < db/queries.sql` | `Get-Content db\queries.sql \| docker compose exec -T db psql -U todo -d todo` |
| `npm run db:migrate -- --name <cambio>` | `npx prisma migrate dev --name <cambio>` (en `backend\`) |
| `orden1 && orden2` | Una orden por línea |

### Llamar a la API desde PowerShell

Los ejemplos con `curl -d '{...}'` de [`api.md`](api.md) no sirven tal cual en PowerShell 5.1: al pasarle el JSON a `curl.exe` le quita las comillas internas y Express responde `INVALID_JSON`. Usa `Invoke-RestMethod`, y manda el cuerpo como bytes UTF-8: si se lo pasas como texto, PowerShell 5.1 no lo codifica en UTF-8 y las tildes y la ñ llegan como `�`.

```powershell
$api = "http://localhost:3000/api/tasks"
$body = [Text.Encoding]::UTF8.GetBytes((@{ title = "Comprar pan" } | ConvertTo-Json))
$task = Invoke-RestMethod -Method Post -Uri $api -ContentType "application/json; charset=utf-8" -Body $body
Invoke-RestMethod -Uri "$api`?completed=false"
Invoke-RestMethod -Method Delete -Uri "$api/$($task.id)"
```

## Pruebas y comprobaciones antes de un PR

Con la base levantada (`docker compose up -d db`):

```powershell
cd backend
npm run lint
npm run typecheck
npm test
cd ..\frontend
npm run lint
npm run typecheck
npm run build
cd ..
```

`npm test` crea y migra sola la base de pruebas `todo_test`, igual que en Linux: lanza la CLI de Prisma con el mismo `node` (sin `npx`), así que no depende de la shell.

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| `docker` no se reconoce o «Docker Desktop is starting» | Docker Desktop no está abierto. Ábrelo y espera a que diga *Engine running*. |
| Docker Desktop no arranca dentro de una máquina virtual | Falta la virtualización anidada en el hipervisor del anfitrión. |
| `npm` o `npx`: «la ejecución de scripts está deshabilitada» | La política de ejecución de PowerShell; ver [Requisitos](#requisitos). |
| `Ports are not available: exposing port TCP 0.0.0.0:5432` … `Only one usage of each socket address` | Hay un PostgreSQL instalado en Windows. Cambia `POSTGRES_PORT` en `.env` (y el puerto de `DATABASE_URL` y `TEST_DATABASE_URL`). |
| `Ports are not available` … `An attempt was made to access a socket in a way forbidden by its access permissions` | Windows (Hyper-V, WSL) reservó ese puerto. Revisa los rangos con `netsh interface ipv4 show excludedportrange protocol=tcp` y elige otro puerto en `.env` (`POSTGRES_PORT`, `FRONTEND_PORT`, `API_PORT`). |
| `npm ci` lento o con errores `EPERM` | Un antivirus o el editor tiene abiertos archivos de `node_modules`. Cierra `npm run dev` y vuelve a correr `npm ci`. |

## Comprobación rápida

Para verificar una máquina Windows nueva de punta a punta, desde un clon limpio (en PowerShell, en la raíz del repositorio):

```powershell
git config --get core.autocrlf                      # en Git para Windows suele ser true
git ls-files --eol backend/prisma/migrations | Select-String "w/crlf"   # sin resultados
docker compose up --build -d
docker compose ps -a                                # db y backend (healthy), migrate Exited (0)
curl.exe http://localhost:4000/health               # {"status":"ok"}
docker compose down
Copy-Item .env.example .env
docker compose up -d db
cd backend
npm ci
npm run db:deploy
npm test                                            # 31 pruebas en verde
cd ..\frontend
npm ci
npm run build
cd ..
```

Y en el navegador, con `npm run dev` en `backend` y en `frontend`: crear una tarea, completarla, filtrar por estado y eliminarla en http://localhost:3000.
