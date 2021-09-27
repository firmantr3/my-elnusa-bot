require('dotenv').config();

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://elearning.nusamandiri.ac.id/login');
  await page.type(`#username`, process.env.NIM);
  await page.type(`#password`, process.env.PASSWORD);
  await page.screenshot({ path: 'screenshots/login.png' });

  await page.click(`body > div.w-screen.h-screen.flex.flex-col.justify-center.items-center > form > button`);
  await page.waitForNetworkIdle();
  await page.screenshot({ path: 'screenshots/home.png' });

  await page.goto(`http://elearning.nusamandiri.ac.id/sch`);
  await page.screenshot({ path: 'screenshots/jadwal.png', fullPage: true });

  // list jadwal
  const jadwals = await page.evaluate(() => {
    const jadwalBoxes = document.querySelectorAll(`body > div.page-wrapper.pinned > div > div.main-container > div > div > div`);
    const resultArray = [];
    jadwalBoxes.forEach((jadwalBox) => {
      resultArray.push({
        kelas: jadwalBox.querySelector(`h6.pricing-title`).innerText,
        waktu: jadwalBox.querySelector(`div.pricing-save`).innerText,
        tugasUrl: jadwalBox.querySelector(`div > div.pricing-footer > div > a:nth-child(4)`).href,
        tugasData: null,
      });
    });

    return resultArray;
  });

  for(let i = 0; i < jadwals.length; i++) {
    await page.goto(jadwals[i].tugasUrl);

    // fetch the tugas
    let tugasData = await page.evaluate(() => {
      const tugasData = [];
      const tugasRows = document.querySelectorAll(`.main-container .tab-content > .tab-pane:nth-child(1) table.table > tbody > tr`);
      tugasRows.forEach(tugasRow => {
        if(tugasRow.querySelectorAll(`td`).length == 1) {
          return;
        }

        let deskripsi = tugasRow.querySelector(`td:nth-child(5)`).innerText.replace(`… More`, '');
        let deskripsiMore = tugasRow.querySelector(`td:nth-child(5) span.details`);
        if(deskripsiMore) {
          deskripsi += deskripsiMore.innerText;
        }
        
        tugasData.push({
          judul: tugasRow.querySelector(`td:nth-child(4)`).innerText,
          deskripsi: deskripsi,
          mulai: tugasRow.querySelector(`td:nth-child(7)`).innerText,
          selesai: tugasRow.querySelector(`td:nth-child(8)`).innerText,
        });
      });

      return tugasData;
    });

    if(tugasData.length) {
      jadwals[i].tugasData = tugasData;
    }

    await page.screenshot({ path: `screenshots/tugas${jadwals[i].kelas}.png` });
  }

  const availableTugas = jadwals.filter((jadwal) => {
    return jadwal.tugasData !== null;
  })
  .map(jadwal => {
    return jadwal.tugasData.map(tugas => {
      return {
        kelas: jadwal.kelas,
        waktu: jadwal.waktu,
        ...tugas,
      };
    });
  })
  .flat();

  const fs = require('fs');
  const dateStamp = (new Date).toDateString();
  const path = require('path');
  const resultPath = path.normalize(`${__dirname}/results/${dateStamp}.json`);
  try {
    const data = fs.writeFileSync(resultPath, JSON.stringify(availableTugas), { flag: 'w+' });
    //file written successfully

    console.log(resultPath);
  } catch (err) {
    console.error(err);
  }

  await browser.close();
})();
