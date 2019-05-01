type 'a parser
type 'a erroneous_parser

val initial :
  (Lexing.position -> 'a Reason_parser.MenhirInterpreter.checkpoint) ->
  Lexing.position -> 'a parser

type 'a step =
  | Intermediate of 'a parser
  | Success of 'a * Reason_lexer.invalid_docstrings
  | Error of 'a erroneous_parser

val step : 'a parser -> Reason_parser.token Reason_lexer.positioned -> 'a step
