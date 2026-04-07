import { Router } from 'express';
import { buildResponse } from '../utils/response.js';

export const routesCompareRouter = Router();

routesCompareRouter.get('/compare', (_request, response) => {
  response.json(
    buildResponse({
      options: [
        {
          label: '버스 우선 이동',
          burden: '보통',
          note: '가까운 버스가 있으나 정류장 접근 시간이 다소 필요합니다.',
        },
        {
          label: '이동지원 우선 검토',
          burden: '낮음',
          note: '대체 수단 가용 차량이 있어 보수적으로 더 편안한 선택지입니다.',
        },
      ],
    }),
  );
});
