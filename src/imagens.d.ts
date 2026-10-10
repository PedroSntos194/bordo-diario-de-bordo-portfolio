// Tipos dos imports de imagem (`import logo from './logo.png'`).
//
// Quem os declara é o `next-env.d.ts`, que o Next gera ao rodar e que fica
// fora do git. A CI checa os tipos antes do build, quando ele ainda não
// existe — sem esta referência, o import da logo quebrava o typecheck lá.
/// <reference types="next/image-types/global" />
