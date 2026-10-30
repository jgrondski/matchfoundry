import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const STYLE_OBJECT = "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression";

/**
 * Style-migration rules (Phase 11). Run on specific files:
 *   npm run lint:styles -- src/path/File.tsx
 * Merged into eslint.config.js in step 11.3.
 */
export const styleRestrictions = [
  { selector: `${STYLE_OBJECT} > Property[value.type='Literal']`, message: 'Static inline style value. Use Tailwind classes.' },
  { selector: `${STYLE_OBJECT} > Property[value.type='TemplateLiteral'][value.expressions.length=0]`, message: 'Static inline style value. Use Tailwind classes.' },
  { selector: `${STYLE_OBJECT} > Property[value.type='UnaryExpression'][value.argument.type='Literal']`, message: 'Static inline style value. Use Tailwind classes.' },
  { selector: `${STYLE_OBJECT} > Property[value.type='ConditionalExpression'][value.consequent.type='Literal'][value.alternate.type='Literal']`, message: 'Static conditional style. Use conditional classes with cn().' },
  { selector: "JSXAttribute[name.name='style'] > JSXExpressionContainer > Identifier", message: 'style={variable} is not allowed. Use classes, or an inline object holding only runtime values.' },
  { selector: "JSXAttribute[name.name='style'] Literal[value=/^#[0-9a-fA-F]{3,8}$/]", message: 'Hex color in a style. Use a theme token class.' },
  { selector: "VariableDeclarator[id.typeAnnotation.typeAnnotation.typeName.right.name='CSSProperties']", message: 'CSSProperties constants are not allowed. Use class strings.' },
  { selector: "VariableDeclarator[id.typeAnnotation.typeAnnotation.typeName.name='CSSProperties']", message: 'CSSProperties constants are not allowed. Use class strings.' },
  { selector: "JSXAttribute[name.name='className'] Literal[value=/(^|\\s)(btn|badge)(-[a-z]+)?(\\s|$)/]", message: 'Legacy btn/badge class. Use <Button>, <Badge> or buttonClasses().' },
  { selector: "AssignmentExpression[left.object.property.name='style']", message: 'Direct style mutation. Use hover:/focus: classes or state with cn().' },
];

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: { 'no-restricted-syntax': ['error', ...styleRestrictions] },
  }
);
