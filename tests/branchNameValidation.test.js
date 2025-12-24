const { formatBranchName } = require('../src/cli/utils/branchName');

/**
 * Suite de pruebas para validaciones de nombres de rama.
 * Ejecuta: node tests/branchNameValidation.test.js
 */

console.log('🧪 Iniciando pruebas de validación de nombres de rama...\n');

// Contador de pruebas
let passed = 0;
let failed = 0;

/**
 * Función auxiliar para ejecutar una prueba.
 */
function test(description, fn) {
    try {
        fn();
        console.log(`✅ ${description}`);
        passed++;
    } catch (error) {
        console.log(`❌ ${description}`);
        console.log(`   Error: ${error.message}\n`);
        failed++;
    }
}

/**
 * Función auxiliar para verificar que una función lance un error.
 */
function expectError(fn, expectedMessage) {
    try {
        fn();
        throw new Error('Se esperaba un error pero no se lanzó ninguno');
    } catch (error) {
        if (expectedMessage && !error.message.includes(expectedMessage)) {
            throw new Error(`Mensaje de error incorrecto. Esperado: "${expectedMessage}", Recibido: "${error.message}"`);
        }
    }
}

// ============================================================================
// PRUEBAS DE CASOS VÁLIDOS
// ============================================================================

console.log('📋 Casos válidos:\n');

test('Debe aceptar nombres de rama válidos básicos', () => {
    const result = formatBranchName({
        userAlias: 'jdoe',
        branchType: 'feature',
        descriptor: 'add-login'
    });
    if (result !== 'jdoe/feature/add-login') {
        throw new Error(`Resultado inesperado: ${result}`);
    }
});

test('Debe manejar espacios convirtiéndolos a guiones', () => {
    const result = formatBranchName({
        userAlias: 'john doe',
        branchType: 'feature',
        descriptor: 'add user login'
    });
    if (result !== 'john-doe/feature/add-user-login') {
        throw new Error(`Resultado inesperado: ${result}`);
    }
});

test('Debe convertir a minúsculas', () => {
    const result = formatBranchName({
        userAlias: 'JohnDoe',
        branchType: 'FEATURE',
        descriptor: 'AddLogin'
    });
    if (result !== 'johndoe/feature/addlogin') {
        throw new Error(`Resultado inesperado: ${result}`);
    }
});

test('Debe aceptar números en los segmentos', () => {
    const result = formatBranchName({
        userAlias: 'user123',
        branchType: 'bugfix',
        descriptor: 'fix-issue-456'
    });
    if (result !== 'user123/bugfix/fix-issue-456') {
        throw new Error(`Resultado inesperado: ${result}`);
    }
});

// ============================================================================
// PRUEBAS DE CARACTERES ESPECIALES
// ============================================================================

console.log('\n📋 Validación de caracteres especiales:\n');

test('Debe rechazar caracteres especiales problemáticos en alias (@)', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'user@domain',
            branchType: 'feature',
            descriptor: 'test'
        });
    }, 'caracteres especiales no permitidos');
});

test('Debe rechazar caracteres especiales problemáticos en descriptor (*)', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'user',
            branchType: 'feature',
            descriptor: 'fix-*-issue'
        });
    }, 'caracteres especiales no permitidos');
});

test('Debe rechazar paréntesis en descriptor', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'user',
            branchType: 'feature',
            descriptor: 'fix(urgent)'
        });
    }, 'caracteres especiales no permitidos');
});

test('Debe rechazar corchetes en descriptor', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'user',
            branchType: 'feature',
            descriptor: 'fix[123]'
        });
    }, 'caracteres especiales no permitidos');
});

// ============================================================================
// PRUEBAS DE LONGITUD
// ============================================================================

console.log('\n📋 Validación de longitud:\n');

test('Debe rechazar segmentos demasiado largos (alias)', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'a'.repeat(51), // 51 caracteres
            branchType: 'feature',
            descriptor: 'test'
        });
    }, 'demasiado largo');
});

test('Debe rechazar segmentos demasiado largos (descriptor)', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'user',
            branchType: 'feature',
            descriptor: 'a'.repeat(51) // 51 caracteres
        });
    }, 'demasiado largo');
});

test('Debe rechazar nombres de rama que excedan 255 caracteres', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'a'.repeat(50),
            branchType: 'feature',
            descriptor: 'b'.repeat(200)
        });
    }, 'demasiado largo');
});

test('Debe aceptar segmentos en el límite de longitud (50 caracteres)', () => {
    const result = formatBranchName({
        userAlias: 'user',
        branchType: 'feature',
        descriptor: 'a'.repeat(50)
    });
    if (!result.includes('a'.repeat(50))) {
        throw new Error('No aceptó un descriptor de 50 caracteres');
    }
});

// ============================================================================
// PRUEBAS DE NOMBRES RESERVADOS
// ============================================================================

console.log('\n📋 Validación de nombres reservados:\n');

test('Debe rechazar "master" como tipo de rama', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'user',
            branchType: 'master',
            descriptor: 'test'
        });
    }, 'reservado');
});

test('Debe rechazar "main" como descriptor', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'user',
            branchType: 'feature',
            descriptor: 'main'
        });
    }, 'reservado');
});

test('Debe rechazar "HEAD" en cualquier segmento', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'HEAD',
            branchType: 'feature',
            descriptor: 'test'
        });
    }, 'reservado');
});

// ============================================================================
// PRUEBAS DE SEPARADORES
// ============================================================================

console.log('\n📋 Validación de separadores:\n');

test('Debe rechazar guiones consecutivos en descriptor', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'user',
            branchType: 'feature',
            descriptor: 'fix--issue'
        });
    }, 'guiones consecutivos');
});

// ============================================================================
// PRUEBAS DE SEGMENTOS VACÍOS
// ============================================================================

console.log('\n📋 Validación de segmentos vacíos:\n');

test('Debe rechazar alias vacío', () => {
    expectError(() => {
        formatBranchName({
            userAlias: '',
            branchType: 'feature',
            descriptor: 'test'
        });
    }, 'alias válido');
});

test('Debe rechazar tipo de rama vacío', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'user',
            branchType: '',
            descriptor: 'test'
        });
    }, 'tipo de rama');
});

test('Debe rechazar descriptor vacío', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'user',
            branchType: 'feature',
            descriptor: ''
        });
    }, 'descriptor');
});

test('Debe rechazar descriptor que solo contiene caracteres especiales', () => {
    expectError(() => {
        formatBranchName({
            userAlias: 'user',
            branchType: 'feature',
            descriptor: '!@#$%'
        });
    }, 'caracteres especiales no permitidos');
});

// ============================================================================
// RESUMEN DE RESULTADOS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN DE PRUEBAS');
console.log('='.repeat(60));
console.log(`✅ Pruebas exitosas: ${passed}`);
console.log(`❌ Pruebas fallidas: ${failed}`);
console.log(`📈 Total de pruebas: ${passed + failed}`);
console.log(`🎯 Tasa de éxito: ${((passed / (passed + failed)) * 100).toFixed(2)}%`);
console.log('='.repeat(60));

if (failed > 0) {
    process.exit(1);
}
