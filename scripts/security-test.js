/**
 * Script de Pruebas de Seguridad Básicas
 * Basado en OWASP Top 10
 * 
 * Ejecutar con: node scripts/security-test.js
 */

const tests = {
  // Test 1: Verificar que no hay eval() o innerHTML peligroso
  dangerousFunctions: {
    name: 'Búsqueda de funciones peligrosas',
    check: async () => {
      const fs = require('fs');
      const path = require('path');
      const srcDir = path.join(__dirname, '../src');
      
      const dangerous = ['eval(', 'innerHTML', 'document.write', 'Function('];
      const files = getAllFiles(srcDir);
      const issues = [];
      
      files.forEach(file => {
        if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
          const content = fs.readFileSync(file, 'utf8');
          dangerous.forEach(danger => {
            if (content.includes(danger)) {
              // Verificar si está comentado o en contexto seguro
              const lines = content.split('\n');
              lines.forEach((line, idx) => {
                if (line.includes(danger) && !line.trim().startsWith('//') && !line.includes('dangerouslySetInnerHTML')) {
                  // Verificar si es dangerouslySetInnerHTML (necesita sanitización)
                  if (danger === 'innerHTML' && line.includes('dangerouslySetInnerHTML')) {
                    if (!line.includes('DOMPurify') && !line.includes('sanitize')) {
                      issues.push({
                        file: file.replace(srcDir, 'src'),
                        line: idx + 1,
                        issue: 'dangerouslySetInnerHTML sin sanitización',
                        severity: 'HIGH'
                      });
                    }
                  } else if (danger !== 'innerHTML') {
                    issues.push({
                      file: file.replace(srcDir, 'src'),
                      line: idx + 1,
                      issue: `Uso de ${danger}`,
                      severity: 'CRITICAL'
                    });
                  }
                }
              });
            }
          });
        }
      });
      
      return issues;
    }
  },
  
  // Test 2: Verificar variables de entorno sensibles
  envVariables: {
    name: 'Verificación de variables de entorno',
    check: async () => {
      const fs = require('fs');
      const path = require('path');
      const srcDir = path.join(__dirname, '../src');
      const files = getAllFiles(srcDir);
      const issues = [];
      const sensitive = ['SECRET', 'PASSWORD', 'PRIVATE_KEY', 'API_KEY'];
      
      files.forEach(file => {
        if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
          const content = fs.readFileSync(file, 'utf8');
          sensitive.forEach(sens => {
            if (content.includes(sens) && !content.includes('PUBLIC_') && !content.includes('//')) {
              const lines = content.split('\n');
              lines.forEach((line, idx) => {
                if (line.includes(sens) && !line.trim().startsWith('//')) {
                  issues.push({
                    file: file.replace(srcDir, 'src'),
                    line: idx + 1,
                    issue: `Posible exposición de ${sens}`,
                    severity: 'HIGH'
                  });
                }
              });
            }
          });
        }
      });
      
      return issues;
    }
  },
  
  // Test 3: Verificar validación de inputs
  inputValidation: {
    name: 'Verificación de validación de inputs',
    check: async () => {
      const fs = require('fs');
      const path = require('path');
      const srcDir = path.join(__dirname, '../src');
      const files = getAllFiles(srcDir);
      const issues = [];
      
      files.forEach(file => {
        if (file.includes('RegistrationModal') || file.includes('PaymentProofModal')) {
          const content = fs.readFileSync(file, 'utf8');
          
          // Buscar insert/update sin validación
          if (content.includes('.insert(') || content.includes('.update(')) {
            const hasValidation = content.includes('validate') || content.includes('validation');
            if (!hasValidation) {
              issues.push({
                file: file.replace(srcDir, 'src'),
                issue: 'Operaciones de BD sin validación aparente',
                severity: 'MEDIUM'
              });
            }
          }
        }
      });
      
      return issues;
    }
  }
};

function getAllFiles(dir, fileList = []) {
  const fs = require('fs');
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = require('path').join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !filePath.includes('node_modules')) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

async function runTests() {
  console.log('🔒 Iniciando Auditoría de Seguridad\n');
  console.log('=' .repeat(50));
  
  const results = {};
  
  for (const [key, test] of Object.entries(tests)) {
    console.log(`\n📋 ${test.name}...`);
    try {
      const issues = await test.check();
      results[key] = issues;
      
      if (issues.length === 0) {
        console.log('  ✅ Sin problemas encontrados');
      } else {
        console.log(`  ⚠️  ${issues.length} problema(s) encontrado(s):`);
        issues.forEach(issue => {
          const severity = issue.severity === 'CRITICAL' ? '🔴' : 
                         issue.severity === 'HIGH' ? '🟠' : '🟡';
          console.log(`  ${severity} ${issue.severity}: ${issue.issue}`);
          if (issue.file) console.log(`     Archivo: ${issue.file}`);
          if (issue.line) console.log(`     Línea: ${issue.line}`);
        });
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      results[key] = { error: error.message };
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Resumen:');
  
  const totalIssues = Object.values(results)
    .filter(r => Array.isArray(r))
    .reduce((sum, issues) => sum + issues.length, 0);
  
  const critical = Object.values(results)
    .filter(r => Array.isArray(r))
    .flat()
    .filter(i => i.severity === 'CRITICAL').length;
  
  const high = Object.values(results)
    .filter(r => Array.isArray(r))
    .flat()
    .filter(i => i.severity === 'HIGH').length;
  
  console.log(`  Total de problemas: ${totalIssues}`);
  console.log(`  🔴 Críticos: ${critical}`);
  console.log(`  🟠 Altos: ${high}`);
  console.log(`  🟡 Medios: ${totalIssues - critical - high}`);
  
  if (totalIssues > 0) {
    console.log('\n⚠️  Revisa SECURITY_AUDIT.md para más detalles y soluciones');
    process.exit(1);
  } else {
    console.log('\n✅ No se encontraron problemas críticos');
    process.exit(0);
  }
}

runTests();




