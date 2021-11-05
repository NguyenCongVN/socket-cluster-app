import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // sử dụng ws adapter
  app.useWebSocketAdapter(new WsAdapter(app));

  const port = Math.floor(Math.random() * 10)
  console.log(port)

  await app.listen(parseInt(process.env['PORT'] , 10) || port);
}
bootstrap();
