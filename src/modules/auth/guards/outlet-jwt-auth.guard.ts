import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class StoreJwtAuthGuard extends AuthGuard('Outlet-jwt') {}
