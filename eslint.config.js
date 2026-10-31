import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const STYLE_OBJECT = "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression";

/** Styling rules: Tailwind classes only; inline style only for runtime values. */
const styleRestrictions = [
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

const HEX_ANYWHERE = {
  selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
  message: 'Hex color literal. Use a theme token, or add it to src/theme/palette.ts.',
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**'],
    rules: { 'no-restricted-syntax': ['error', ...styleRestrictions, HEX_ANYWHERE] },
  },
  {
    // Hex color data is allowed only in the palette module and database defaults.
    files: ['src/theme/palette.ts', 'src/db/**'],
    rules: { 'no-restricted-syntax': ['error', ...styleRestrictions] },
  }
);
