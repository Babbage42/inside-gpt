import { Routes } from '@angular/router';

// La V1 est une archive servie sous /v1 : le routeur doit seulement accepter cette adresse.
export const routes: Routes = [{ path: 'v1', children: [] }];
