import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body && 'error' in (body as object)) {
        res.status(status).json(body);
        return;
      }
      const message =
        status === HttpStatus.BAD_REQUEST
          ? 'اطلاعات واردشده معتبر نیست'
          : status === HttpStatus.UNAUTHORIZED
            ? 'وارد حساب نشده‌اید'
            : status === HttpStatus.FORBIDDEN
              ? 'به این بخش دسترسی ندارید'
              : status === HttpStatus.NOT_FOUND
                ? 'مورد پیدا نشد'
                : 'خطای سرور';
      res.status(status).json({ error: { code: `HTTP_${status}`, message } });
      return;
    }
    console.error(exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL', message: 'خطای داخلی سرور' },
    });
  }
}
