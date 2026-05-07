import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Optional: Global validation pipe for class-validator
  // app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(3000, '0.0.0.0');
  console.log('Backend API running on http://0.0.0.0:3000');
}
bootstrap();
