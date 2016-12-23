var lineBreak = require('os').EOL;
var emptyCharacter = '';

var Marker = require('../tokenizer/marker');
var Token = require('../tokenizer/token');

var INDENT_BY = 2; // spaces

function supportsAfterClosingBrace(token) {
  return token[1][1] == 'background' || token[1][1] == 'transform' || token[1][1] == 'src';
}

function afterClosingBrace(token, valueIndex) {
  return token[valueIndex][1][token[valueIndex][1].length - 1] == Marker.CLOSE_ROUND_BRACKET;
}

function afterComma(token, valueIndex) {
  return token[valueIndex][1] == Marker.COMMA;
}

function afterSlash(token, valueIndex) {
  return token[valueIndex][1] == Marker.FORWARD_SLASH;
}

function beforeComma(token, valueIndex) {
  return token[valueIndex + 1] && token[valueIndex + 1][1] == Marker.COMMA;
}

function beforeSlash(token, valueIndex) {
  return token[valueIndex + 1] && token[valueIndex + 1][1] == Marker.FORWARD_SLASH;
}

function inFilter(token) {
  return token[1][1] == 'filter' || token[1][1] == '-ms-filter';
}

function inSpecialContext(token, valueIndex, context) {
  return !context.spaceAfterClosingBrace && supportsAfterClosingBrace(token) && afterClosingBrace(token, valueIndex) ||
    beforeSlash(token, valueIndex) ||
    afterSlash(token, valueIndex) ||
    beforeComma(token, valueIndex) ||
    afterComma(token, valueIndex);
}

function rules(tokens, context) {
  var store = context.store;

  for (var i = 0, l = tokens.length; i < l; i++) {
    store(tokens[i], context);

    if (i < l - 1) {
      store(comma(context), context);
    }
  }
}

function body(tokens, context) {
  var lastPropertyAt = lastPropertyIndex(tokens);

  for (var i = 0, l = tokens.length; i < l; i++) {
    property(tokens, i, lastPropertyAt, context);
  }
}

function lastPropertyIndex(tokens) {
  var index = tokens.length - 1;

  for (; index >= 0; index--) {
    if (tokens[index][0] != Token.COMMENT) {
      break;
    }
  }

  return index;
}

function property(tokens, position, lastPropertyAt, context) {
  var store = context.store;
  var token = tokens[position];
  var isPropertyBlock = token[2][0] == Token.PROPERTY_BLOCK;
  var needsSemicolon = position < lastPropertyAt || isPropertyBlock;
  var isLast = position === lastPropertyAt;

  switch (token[0]) {
    case Token.AT_RULE:
      store(token, context);
      store(position < lastPropertyAt ? semicolon(context, false) : emptyCharacter, context);
      break;
    case Token.COMMENT:
      store(token, context);
      break;
    case Token.PROPERTY:
      store(token[1], context);
      store(colon(context), context);
      value(token, context);
      store(needsSemicolon ? semicolon(context, isLast) : emptyCharacter, context);
  }
}

function value(token, context) {
  var store = context.store;
  var j, m;

  if (token[2][0] == Token.PROPERTY_BLOCK) {
    store(openBrace(context, false), context);
    body(token[2][1], context);
    store(closeBrace(context, true), context);
  } else {
    for (j = 2, m = token.length; j < m; j++) {
      store(token[j], context);

      if (j < m - 1 && (inFilter(token) || !inSpecialContext(token, j, context))) {
        store(Marker.SPACE, context);
      }
    }
  }
}

function openBrace(context, needsPrefixSpace) {
  if (context.beautify) {
    context.indent += INDENT_BY;
    context.indentSpaces = Marker.SPACE.repeat(context.indent);
    return (needsPrefixSpace ? Marker.SPACE : emptyCharacter) + Marker.OPEN_BRACE + lineBreak + context.indentSpaces;
  } else {
    return Marker.OPEN_BRACE;
  }
}

function closeBrace(context, isLast) {
  if (context.beautify) {
    context.indent -= INDENT_BY;
    context.indentSpaces = Marker.SPACE.repeat(context.indent);
    return lineBreak + context.indentSpaces + Marker.CLOSE_BRACE + (isLast ? emptyCharacter : lineBreak + context.indentSpaces);
  } else {
    return Marker.CLOSE_BRACE;
  }
}

function colon(context) {
  return context.beautify ?
    Marker.COLON + Marker.SPACE :
    Marker.COLON;
}

function semicolon(context, isLast) {
  return context.beautify ?
    Marker.SEMICOLON + (isLast ? emptyCharacter : lineBreak + context.indentSpaces) :
    Marker.SEMICOLON;
}

function comma(context) {
  return context.beautify ?
    Marker.COMMA + lineBreak + context.indentSpaces :
    Marker.COMMA;
}

function all(tokens, context) {
  var joinCharacter = context.keepBreaks && !context.beautify ? lineBreak : emptyCharacter;
  var store = context.store;
  var token;
  var isLast;
  var i, l;

  for (i = 0, l = tokens.length; i < l; i++) {
    token = tokens[i];
    isLast = i == l - 1;

    switch (token[0]) {
      case Token.AT_RULE:
        store(token, context);
        store(semicolon(context, isLast), context);
        break;
      case Token.AT_RULE_BLOCK:
        rules(token[1], context);
        store(openBrace(context, true), context);
        body(token[2], context);
        store(closeBrace(context, isLast), context);
        break;
      case Token.BLOCK:
        rules(token[1], context);
        store(openBrace(context, true), context);
        store(joinCharacter, context);
        all(token[2], context);
        store(joinCharacter, context);
        store(closeBrace(context, isLast), context);
        break;
      case Token.COMMENT:
        store(token, context);
        break;
      case Token.RULE:
        rules(token[1], context);
        store(openBrace(context, true), context);
        body(token[2], context);
        store(closeBrace(context, isLast), context);
        break;
    }

    if (i < l - 1) {
      store(joinCharacter, context);
    }
  }
}

module.exports = {
  all: all,
  body: body,
  property: property,
  rules: rules,
  value: value
};