# Validaciones de Nombres de Rama

Este documento describe todas las validaciones implementadas en `branchName.js` para garantizar que los nombres de rama cumplan con las mejores prácticas de Git y sean consistentes.

## Tabla de Contenidos

1. [Constantes de Validación](#constantes-de-validación)
2. [Validaciones Implementadas](#validaciones-implementadas)
3. [Ejemplos de Uso](#ejemplos-de-uso)
4. [Mensajes de Error](#mensajes-de-error)

## Constantes de Validación

### Límites de Longitud

```javascript
const MAX_BRANCH_NAME_LENGTH = 255; // Límite práctico de Git
const MAX_SEGMENT_LENGTH = 50;      // Límite recomendado por segmento
const MIN_SEGMENT_LENGTH = 1;       // Mínimo de caracteres por segmento
```

### Nombres Reservados

Los siguientes nombres no pueden usarse en ningún segmento de la rama:

- `head` - Referencia especial de Git
- `master` - Rama principal tradicional
- `main` - Rama principal moderna
- `develop` - Rama de desarrollo común
- `release` - Prefijo de ramas de release
- `hotfix` - Prefijo de ramas de hotfix

### Caracteres Especiales Prohibidos

```javascript
~  ^  :  ?  *  [  ]  \  @  {  }  <  >  |  '  "  `  ;  (  )  &  $  !  %
```

## Validaciones Implementadas

### 1. Validación de Caracteres Especiales

**Función:** `validateSpecialCharacters(segment, segmentName)`

**Cuándo:** Antes del proceso de slugify

**Qué valida:**
- Detecta caracteres especiales problemáticos que Git no maneja bien
- Previene problemas con shells y sistemas de archivos
- Evita conflictos con sintaxis de Git

**Ejemplo de error:**
```javascript
formatBranchName({
  userAlias: 'user@domain',
  branchType: 'feature',
  descriptor: 'test'
});
// Error: El alias contiene caracteres especiales no permitidos: @.
// Usa solo letras, números, espacios y guiones.
```

### 2. Validación de Nombres Reservados

**Funciones:**
- `validateReservedName(segment, segmentName)` - Valida segmentos individuales
- `validateReservedNames(branchName)` - Valida el nombre completo

**Cuándo:**
- Antes del slugify (para segmentos individuales)
- Después de construir el nombre completo

**Qué valida:**
- Previene el uso de nombres reservados de Git
- Evita conflictos con ramas estándar
- Comparación case-insensitive (HEAD = head = Head)

**Ejemplo de error:**
```javascript
formatBranchName({
  userAlias: 'user',
  branchType: 'master',
  descriptor: 'test'
});
// Error: El tipo de rama "master" está reservado y no puede usarse.
// Nombres reservados: head, master, main, develop, release, hotfix.
```

### 3. Validación de Longitud de Segmentos

**Función:** `validateSegmentLength(segment, segmentName)`

**Cuándo:** Después del proceso de slugify

**Qué valida:**
- Segmentos no excedan 50 caracteres (legibilidad)
- Segmentos tengan al menos 1 carácter
- Previene nombres de rama excesivamente largos

**Ejemplo de error:**
```javascript
formatBranchName({
  userAlias: 'a'.repeat(51),
  branchType: 'feature',
  descriptor: 'test'
});
// Error: El alias es demasiado largo (51 caracteres).
// El máximo permitido es 50 caracteres.
```

### 4. Validación de Longitud Total

**Cuándo:** Después de construir el nombre completo de la rama

**Qué valida:**
- El nombre completo no exceda 255 caracteres
- Cumple con límites prácticos de Git
- Previene problemas con sistemas de archivos

**Ejemplo de error:**
```javascript
formatBranchName({
  userAlias: 'a'.repeat(50),
  branchType: 'feature',
  descriptor: 'b'.repeat(200)
});
// Error: El nombre de la rama es demasiado largo (258 caracteres).
// El máximo permitido es 255 caracteres. Intenta usar un descriptor más corto.
```

### 5. Validación de Separadores

**Función:** `validateSeparators(branchName)`

**Cuándo:** Después de construir el nombre completo

**Qué valida:**
- No hay barras consecutivas (`//`)
- No comienza ni termina con barra (`/`)
- No hay guiones consecutivos (`--`)

**Ejemplo de error:**
```javascript
formatBranchName({
  userAlias: 'user',
  branchType: 'feature',
  descriptor: 'fix--issue'
});
// Error: Los segmentos no pueden contener guiones consecutivos (--).
```

### 6. Validación de Segmentos Vacíos

**Cuándo:** Después del proceso de slugify

**Qué valida:**
- Ningún segmento quede vacío después del slugify
- Todos los segmentos generen contenido válido
- Previene nombres de rama incompletos

**Ejemplo de error:**
```javascript
formatBranchName({
  userAlias: '',
  branchType: 'feature',
  descriptor: 'test'
});
// Error: No fue posible determinar un alias válido.
// Configura uno con "gitbrancher config --alias <alias>".
```

### 7. Validación de Ramas Remotas (Opcional)

**Función:** `checkRemoteBranchExists(branchName)` en `gitService.js`

**Cuándo:** Durante la creación de la rama (si está habilitado)

**Qué valida:**
- La rama no existe en el repositorio remoto
- Previene conflictos al hacer push
- Puede deshabilitarse con `{ checkRemote: false }`

**Ejemplo de uso:**
```javascript
// Con validación remota (por defecto)
await createBranch('user/feature/test');

// Sin validación remota
await createBranch('user/feature/test', { checkRemote: false });
```

## Flujo de Validación

El proceso de validación sigue este orden:

```
1. Validar nombres reservados (antes de slugify)
   ↓
2. Validar caracteres especiales (antes de slugify)
   ↓
3. Validar guiones consecutivos (antes de slugify)
   ↓
4. Aplicar slugify a cada segmento
   ↓
5. Validar segmentos no vacíos (después de slugify)
   ↓
6. Validar longitud de cada segmento
   ↓
7. Construir nombre completo
   ↓
8. Validar longitud total
   ↓
9. Validar nombres reservados en nombre completo
   ↓
10. Validar separadores
   ↓
11. Retornar nombre válido
```

## Ejemplos de Uso

### ✅ Casos Válidos

```javascript
// Nombre básico
formatBranchName({
  userAlias: 'jdoe',
  branchType: 'feature',
  descriptor: 'add-login'
});
// Resultado: 'jdoe/feature/add-login'

// Con espacios (se convierten a guiones)
formatBranchName({
  userAlias: 'john doe',
  branchType: 'feature',
  descriptor: 'add user login'
});
// Resultado: 'john-doe/feature/add-user-login'

// Con mayúsculas (se convierten a minúsculas)
formatBranchName({
  userAlias: 'JohnDoe',
  branchType: 'FEATURE',
  descriptor: 'AddLogin'
});
// Resultado: 'johndoe/feature/addlogin'

// Con números
formatBranchName({
  userAlias: 'user123',
  branchType: 'bugfix',
  descriptor: 'fix-issue-456'
});
// Resultado: 'user123/bugfix/fix-issue-456'
```

### ❌ Casos Inválidos

```javascript
// Caracteres especiales
formatBranchName({
  userAlias: 'user@domain',
  branchType: 'feature',
  descriptor: 'test'
});
// ❌ Error: caracteres especiales no permitidos

// Nombres reservados
formatBranchName({
  userAlias: 'HEAD',
  branchType: 'feature',
  descriptor: 'test'
});
// ❌ Error: nombre reservado

// Segmento demasiado largo
formatBranchName({
  userAlias: 'a'.repeat(51),
  branchType: 'feature',
  descriptor: 'test'
});
// ❌ Error: segmento demasiado largo

// Guiones consecutivos
formatBranchName({
  userAlias: 'user',
  branchType: 'feature',
  descriptor: 'fix--issue'
});
// ❌ Error: guiones consecutivos

// Segmento vacío
formatBranchName({
  userAlias: '',
  branchType: 'feature',
  descriptor: 'test'
});
// ❌ Error: alias vacío
```

## Mensajes de Error

Todos los mensajes de error son descriptivos y proporcionan orientación sobre cómo corregir el problema:

| Tipo de Error | Mensaje |
|---------------|---------|
| Caracteres especiales | `El {segmento} contiene caracteres especiales no permitidos: {chars}. Usa solo letras, números, espacios y guiones.` |
| Nombre reservado | `El {segmento} "{valor}" está reservado y no puede usarse. Nombres reservados: head, master, main, develop, release, hotfix.` |
| Segmento largo | `El {segmento} es demasiado largo ({N} caracteres). El máximo permitido es 50 caracteres.` |
| Nombre largo | `El nombre de la rama es demasiado largo ({N} caracteres). El máximo permitido es 255 caracteres. Intenta usar un descriptor más corto.` |
| Guiones consecutivos | `Los segmentos no pueden contener guiones consecutivos (--).` |
| Segmento vacío | `No fue posible determinar un {segmento} válido...` |
| Rama remota existe | `La rama "{nombre}" ya existe en el repositorio remoto. Usa un nombre diferente o sincroniza con "git fetch".` |

## Testing

Para ejecutar las pruebas de validación:

```bash
node tests/branchNameValidation.test.js
```

Las pruebas cubren:
- ✅ 4 casos válidos
- ✅ 4 validaciones de caracteres especiales
- ✅ 4 validaciones de longitud
- ✅ 3 validaciones de nombres reservados
- ✅ 1 validación de separadores
- ✅ 4 validaciones de segmentos vacíos

**Total: 20 pruebas con 100% de éxito**

## Mejores Prácticas

1. **Usa nombres descriptivos**: El descriptor debe explicar claramente el propósito de la rama
2. **Mantén nombres cortos**: Aunque el límite es 50 caracteres por segmento, nombres más cortos son más fáciles de leer
3. **Evita abreviaturas oscuras**: Usa nombres que otros desarrolladores puedan entender
4. **Sigue convenciones**: Usa tipos de rama estándar como `feature`, `bugfix`, `hotfix`
5. **Incluye números de ticket**: Si aplica, incluye el ID del work item en el descriptor

## Beneficios de las Validaciones

1. **Prevención de errores**: Detecta problemas antes de intentar crear la rama
2. **Consistencia**: Garantiza que todos los nombres de rama sigan el mismo formato
3. **Compatibilidad**: Asegura que los nombres funcionen en todos los sistemas operativos
4. **Mejores prácticas**: Fuerza el uso de convenciones estándar de Git
5. **Mensajes claros**: Proporciona retroalimentación útil cuando algo falla
